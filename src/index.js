const express = require("express")
const ObjectId = require("mongodb").ObjectId // to use new ObjectId in MongoDB queries
const cors = require("cors")
const path = require("path") // to work with paths

const jwt = require("jsonwebtoken")

const validator = require("validator")

const mongoClient = require("mongodb").MongoClient
const mongoDBSanitize = require("express-mongo-sanitize")({ allowDots: false }) // to allow the presence of dots, necessary for example to store email addresses that includes dots.

const crypto = require("crypto-js")

require("dotenv").config() // the app will access .env vars through process.env.VARNAME

const app = express()
app.use(cors())
app.use(express.json()) // the app will put requests json in req.body

const swaggerUi = require("swagger-ui-express")
const swaggerDocument = require("./swagger-output.json")

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument)) // returning the swagger at api-docs

const mongoUri = `mongodb+srv://tiz314:${process.env.MONGOPWD}@tunemate.jbivpyu.mongodb.net/?retryWrites=true&w=majority`
const passwordCriteria = { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1, returnScore: false, pointsPerUnique: 1, pointsPerRepeat: 0.5, pointsForContainingLower: 10, pointsForContainingUpper: 10, pointsForContainingNumber: 10, pointsForContainingSymbol: 10 }

const spotifyUrl = "https://accounts.spotify.com/api/token"
const hourTime = 3600000
let spotifyToken = ""
getSpotifyToken()
setInterval(getSpotifyToken, hourTime) // setting the automatic Spotify's token renewal

let usernameBlacklist = [] // in order to track deleted users tokens
let blacklistInterval = setInterval(() => usernameBlacklist = [], hourTime)  // emptying blacklist every hour

const maxTextLength = 30 // used to manage user's info and playlist's info length

app.use(express.static("public/")) // return all the static resources requested, located in public/

/* --- User management --- */

app.post("/user", mongoDBSanitize, async (req, res) => { // signup a new user
    const newUser = req.body

    // all the checks are short-circuited to avoid crashes
    if (newUser.name == undefined || typeof newUser.name != "string" || !validator.isAlpha(newUser.name) || newUser.name.length > maxTextLength) { // typeof require to mitigate object instead of string in custom POSTs
        res.status(400).json({ message: "Name not accepted" })
    }
    else if (newUser.surname == undefined || typeof newUser.surname != "string" || !validator.isAlpha(newUser.surname) || newUser.surname.length > maxTextLength) {
        res.status(400).json({ message: "Surname not accepted" })
    }
    else if (newUser.date == undefined || typeof newUser.date != "string" || !validator.isDate(newUser.date)) {
        res.status(400).json({ message: "Date not accepted" })
    }
    else if (newUser.genres == undefined || !Array.isArray(newUser.genres) || newUser.genres.length == 0 || !isStringArray(newUser.genres)) { // last condition to avoid input like ["genre1", {}]
        res.status(400).json({ message: "Missing genres" })
    }
    else if (newUser.artists == undefined || !Array.isArray(newUser.artists) || newUser.artists.length == 0 || !isStringArray(newUser.artists)) {
        res.status(400).json({ message: "Missing artists" })
    }
    else if (newUser.email == undefined || typeof newUser.email != "string" || !validator.isEmail(newUser.email)) {
        res.status(400).json({ message: "Email not accepted" })
    }
    else if (newUser.username == undefined || typeof newUser.username != "string" || !validator.isAlphanumeric(newUser.username) || usernameBlacklist.includes(newUser.username) || newUser.username.length > maxTextLength) {
        res.status(400).json({ message: "Username not accepted" })
    }
    else if (newUser.password == undefined || typeof newUser.password != "string" || !validator.isStrongPassword(newUser.password, passwordCriteria)) {
        res.status(400).json({ message: "Password not accepted" })
    }
    else {
        // sanitizing every received input except for name, surname and username: eventually malformed input is detected by isAlpha or isAlphanum
        newUser.genres.forEach((element, index) => {
            newUser.genres[index] = sanitize(element)
        })
        newUser.artists.forEach((element, index) => {
            newUser.artists[index] = sanitize(element)
        })
        newUser.password = hash256(newUser.password)

        // Adding the empty followed playlists array to the record
        newUser.followedPlaylists = []

        // Setting joined date
        const now = new Date()
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        newUser.joinDate = `${monthNames[now.getMonth()]} ${now.getFullYear()}`

        newUser.role = "base"

        const client = new mongoClient(mongoUri)
        try {
            await client.db("TuneMate").collection('users').insertOne(newUser)
            res.json({ message: "New user created" })
        }
        catch (err) {
            if (err.code == 11000) {
                res.status(400).json({ message: "User already exists" })
            }
            else res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }

    /*  
    #swagger.tags = ['User']
    #swagger.summary = 'Sign up for a new user'
    #swagger.description = 'It receives mandatory information about the user and inserts it into the DB'

    #swagger.parameters['obj'] = { 
        in: 'body', 
        description: 'User data', 
        required: true,
        schema: { 
            $name: 'Mario', 
            $surname: 'Rossi', 
            $date: '2000-02-02', 
            $genres: ['Lo-Fi', 'House'], 
            $artists: ['Arctic Monkeys', 'The Weeknd'],
            $email: 'marior@mail.com',
            $username: 'm4r10',
            $password: 'Antani13$'
        } 
    }

    #swagger.responses[200] = {
        description: 'The insertion into the db was successful',
        schema: {
            "message": "New user created" 
        }
    }

    #swagger.responses[400] = {
        description: 'Any of the information is missing or the user already exists',
        schema: {
            "message": "Missing <field> or user already exists"
        }
    }

    #swagger.responses[500] = {
        description: 'A DB error different from "an already existing user" has occurred',
        schema: {
            "message": "Internal server error"
        }
    }

    */

})

app.get("/login", (req, res) => { // return if the user is logged. Used for navbar generation and redirect from reserved pages
    let receivedToken = getUserCookie(req) // it returns the jwt token
    if (receivedToken != undefined) {
        const decoded = jwtVerify(receivedToken)
        if (decoded.username != "" && !usernameBlacklist.includes(decoded.username)) { // jwt valid and not blacklisted
            res.json({ username: decoded.username })
        }
        else res.json({ message: "Not logged in" }) // Putting here a 401 status is not logically correct and the error is shown in console when not logged user loads public pages.
    }
    else res.json({ message: "Not logged in" })

    /*

    #swagger.tags = ['User']
    #swagger.summary = 'It returns if the user is logged'
    #swagger.description = 'It only returns the username to reduce the latency'

    #swagger.responses[200] = {
        description: 'The request was successful. This means that the user can be logged in or not',
        schema: {
            "username": "<username> or Not logged in"
        }
    }

    */
})


app.post("/login", mongoDBSanitize, async (req, res) => { // make the login process
    const loginAttempt = req.body
    if (loginAttempt.name != undefined && typeof loginAttempt.name == "string" && loginAttempt.password != undefined && typeof loginAttempt.password == "string") {
        loginAttempt.password = hash256(loginAttempt.password)
        const client = new mongoClient(mongoUri)
        let userList
        if (validator.isEmail(loginAttempt.name)) {
            userList = await client.db("TuneMate").collection('users').findOne({ "email": sanitize(loginAttempt.name) })
        }
        else {
            userList = await client.db("TuneMate").collection('users').findOne({ "username": sanitize(loginAttempt.name) })
        }
        if (userList != null) {
            if (loginAttempt.password === userList.password) {
                const token = jwtSign({ id: userList._id.toString(), username: userList.username }) // baking the cookie payload
                res.cookie('user', token, { httpOnly: true })
                res.json({ success: true })
            }
            else res.status(401).json({ message: "Wrong password" })
        }
        else {
            res.status(404).json({ message: "User does not exist" })
        }
        client.close()
    }
    else res.status(400).json({ message: "Missing login information" })

    /*  

    #swagger.tags = ['User']
    #swagger.summary = 'User login'
    #swagger.description = 'It receives user\'s credentials and performs a login. It is possible to use the username or the email address + password'

    #swagger.parameters['obj'] = { 
        in: 'body', 
        required: true,
        description: 'User data. Name can be the username or the email address', 
        schema: { 
            $name: 'm4r10', 
            $password: 'Antani13$'
        } 
    }

    #swagger.responses[200] = {
        description: 'The login process was successful',
        schema: {
            "success": true
        }
    }

    #swagger.responses[400] = {
        description: 'Any of the information is missing',
        schema: {
            "message": "Missing login information"
        }

    }

    #swagger.responses[401] = {
        description: 'Wrong password',
        schema: {
            "message": "Wrong password"
        }
    }

    #swagger.responses[404] = {
        description: 'The user does not exist',
        schema: {
            "message": "User does not exist"
        }
    }

    */

})

app.get("/logout", (req, res) => {
    res.clearCookie("user")
    res.end() // to send the response without any other content

    /*  

    #swagger.tags = ['User']
    #swagger.summary = 'User logout'
    #swagger.description = 'It clears the user\'s cookie'

    #swagger.responses[200] = {
        description: 'The logout process was successful'
    }

    */

})


app.get("/user", mongoDBSanitize, auth, async (req, res) => { // to obtain all user's data or username and ID by a given username's substring. Used for profile page and playlist proprerty transfer. 
    const client = new mongoClient(mongoUri)
    if (req.query.username != undefined && typeof req.query.username == "string" && validator.isAlphanumeric(req.query.username)) { // username must be defined and exclusively alphanumeric
        const result = await client.db("TuneMate").collection('users').findOne({ username: { $regex: req.query.username } }, { projection: { _id: 1, username: 1 } }) // $regex is used to specify that the input can be substring of the string in the record. Case sensitive!
        if (result == null) {
            res.status(404).json({ message: "User not found!" })
        }
        else res.send(result)
    }
    else {
        const userId = res.locals.id
        const client = new mongoClient(mongoUri)
        const userList = await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } })
        res.send(userList)
    }
    client.close()

    /*  

    #swagger.tags = ['User']
    #swagger.summary = 'Get data of the user'
    #swagger.description = 'It returns all logged user\'s data or username and ID by a given username\'s substring'

    #swagger.responses[200] = {
        description: 'The process was successful',
        schema: {
            "_id": "64a6978e96fbb79353e5028b",
            "name": "Tiz",
            "surname": "r",
            "date": "2005-05-06",
            "genres": [
                "house"
            ],
            "artists": [
                "Arctic Monkeys"
            ],
            "email": "t2@t.com",
            "username": "Tiz314",
            "followedPlaylists": [
                "64a69dd496fbb79353e5028c",
                "64a995c839274f6dfc8b9c7b",
                "64ac546a505552c62cd465a6",
                "64a6978e96fbb79353e5028b",
                "64a992a539274f6dfc8b9c7a",
                "64abdd4b840c60494f9913d4",
                "64ad17595e2ffd91aec4d3cb"
            ],
            "joinDate": "July 2023",
            "role": "base"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[404] = {
        description: 'If searched by username\'s substring, the user was not found',
        schema: {
            "message": "User not found!"
        }
    }

    */
})


app.put("/user", mongoDBSanitize, auth, async (req, res) => { // update user data. Used on profile
    const oldUsername = res.locals.username //retrieving the eventually old username to push it in the blacklist. It is not used because it would ban for an hour the entire user, independently by his username
    const userId = res.locals.id
    const newUser = req.body
    let newData = {}


    // playlist following and unfollowing here:
    if (newUser.newPlaylistId != undefined && typeof newUser.newPlaylistId == "string") {
        /*
        here i'm not checking the correctness of the id: here's why:
        - if the string is not a valid id, an exception is thrown and catched 
        - if the string is a profile id or a private playlist id, the array is updated but the output won't be altered because the query won't include the record
        - if the string is a personal public playlist, this will be shown in the following playlist. Althought, this is not a security issue and can happen only with the manipulation of HTTP requests. So i preferred not to add a check to not make the insertion slower because of an extra check
        */
        const client = new mongoClient(mongoUri)
        try {
            await client.db("TuneMate").collection('users').updateOne({ _id: new ObjectId(userId) }, { $push: { followedPlaylists: new ObjectId(newUser.newPlaylistId) } })
            res.json({ message: "User updated" })
        }
        catch (err) {
            res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }
    else if (newUser.oldPlaylistId != undefined && typeof newUser.oldPlaylistId == "string") { // unfollowing here
        const client = new mongoClient(mongoUri)
        try {
            await client.db("TuneMate").collection('users').updateOne({ _id: new ObjectId(userId) }, { $pull: { followedPlaylists: new ObjectId(newUser.oldPlaylistId) } })
            res.json({ message: "User updated" })
        }
        catch (err) {
            res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }
    else { // updating user's basic information
        if (newUser.name != undefined && typeof newUser.name == "string" && validator.isAlpha(newUser.name) && newUser.name.length <= maxTextLength) { // adding new fields if they are in the correct format
            newData.name = sanitize(newUser.name)
        }
        else {
            res.status(400).json({ message: "Invalid name" })
            return
        }
        if (newUser.surname != undefined && typeof newUser.surname == "string" && validator.isAlpha(newUser.surname) && newUser.surname.length <= maxTextLength) {
            newData.surname = sanitize(newUser.surname)
        }
        else {
            res.status(400).json({ message: "Invalid surname" })
            return
        }
        if (newUser.date != undefined && typeof newUser.date == "string" && validator.isDate(newUser.date)) {
            newData.date = sanitize(newUser.date)
        }
        else {
            res.status(400).json({ message: "Invalid date" })
            return
        }
        if (newUser.genres != undefined && Array.isArray(newUser.genres) && newUser.genres.length >= 1) {
            newData.genres = []
            for (const element of newUser.genres) {
                newData.genres.push(sanitize(element))
            }
        }
        else {
            res.status(400).json({ message: "Invalid genres" })
            return
        }
        if (newUser.artists != undefined && Array.isArray(newUser.artists) && newUser.artists.length >= 1) {
            newData.artists = []
            for (const element of newUser.artists) {
                newData.artists.push(sanitize(element))
            }
        }
        else {
            res.status(400).json({ message: "Invalid artists" })
            return
        }
        if (newUser.email != undefined && typeof newUser.email == "string" && validator.isEmail(newUser.email)) {
            newData.email = sanitize(newUser.email)
        }
        else {
            res.status(400).json({ message: "Invalid email" })
            return
        }
        if (newUser.username != undefined && typeof newUser.username == "string" && validator.isAlphanumeric(newUser.username) && !usernameBlacklist.includes(newUser.username) && newUser.username.length <= maxTextLength) {
            newData.username = sanitize(newUser.username)
        }
        else {
            res.status(400).json({ message: "Invalid username" })
            return
        }
        if (newUser.password != undefined && typeof newUser.password == "string" && validator.isStrongPassword(newUser.password, passwordCriteria)) {
            newData.password = hash256(newUser.password)
        }
        else if (newUser.password != undefined && newUser.password != "") { // if the user effectively tried to change the password with a weaker one
            res.status(400).json({ message: "Invalid password" })
            return
        }

        const client = new mongoClient(mongoUri)
        try {
            await client.db("TuneMate").collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: newData })
            if (newData.password != undefined || (newData.username != undefined && newData.username != oldUsername)) { // if in the previous conditions the password was modified or the username was modified (and different from the old), the blacklist process is performed
                usernameBlacklist.push(oldUsername)
                clearInterval(blacklistInterval) // resetting blacklist timer to cover the new time span required for the new blacklisted user
                blacklistInterval = setInterval(() => usernameBlacklist = [], hourTime)
                res.clearCookie("user") // if user updated password or changed username, a new login is required
            }
            res.json({ message: "User updated" })
        }
        catch (err) {
            if (err.code == 11000) {
                res.status(400).json({ message: "User already exists" })
            }
            else res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }




    /*  

    #swagger.tags = ['User']
    #swagger.summary = 'User update'
    #swagger.description = 'It receives some new pieces of information about the user and it updates the DB. It is possible to: update basic user information; add a single playlist the user wants to follow; or remove a single playlist. One of these operations can be performed at a time. For example, if basic information is found in the body, only basic information updates will be performed.'

    #swagger.parameters['obj'] = { 
        in: 'body', 
        description: 'User data', 
        required: true,
        schema: { 
            $name: 'Mario', 
            $surname: 'Rossi', 
            $date: '2000-02-02', 
            $genres: ['Lo-Fi', 'House'], 
            $artists: ['Arctic Monkeys', 'The Weeknd'],
            $email: 'marior@mail.com',
            $username: 'm4r10',
            $password: 'Antani13$',
            $newPlaylistId: '64a6978e96fbb79353e5028b',
            $oldPlaylistId: '64a6978e96fbb79353e5028b'
        } 
    }

    #swagger.responses[200] = {
        description: 'The update process was successful',
        schema: {
            "message": "User updated"
        }
    }

    #swagger.responses[400] = {
        description: 'Some fields are invalid or user already exists',
        schema: {
            "message": "Invalid <field> or user already exists"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[500] = {
        description: 'A different DB error has occurred',
        schema: {
            "message": "Internal server error"
        }
    }

    */

})

app.delete("/user", auth, async (req, res) => { // delete an user. Used on profile
    const userId = res.locals.id // It doesn't require sanitization because it comes from the cookie and its integrity is already verified by the middleware
    const username = res.locals.username // to be put in the blacklist if deletion is successful
    const client = new mongoClient(mongoUri)

    const response = await client.db("TuneMate").collection('users').deleteOne({ _id: new ObjectId(userId) }) // deleting the user itself
    if (response.deletedCount == 1) {
        res.clearCookie("user")
        usernameBlacklist.push(username)

        clearInterval(blacklistInterval)
        blacklistInterval = setInterval(() => usernameBlacklist = [], hourTime)  // emptying blacklist every hour (resetting timer)


        // deleting now references of the eventually followed playlist from other users
        const personalPublicPlaylistsIds = await client.db("TuneMate").collection('playlists').find({ author: new ObjectId(userId), isPublic: true }).project({ _id: 1 }).toArray()
        personalPublicPlaylistsIds.forEach((element, index) => {
            personalPublicPlaylistsIds[index] = element._id
        })
        await client.db("TuneMate").collection('users').updateMany({}, { $pull: { followedPlaylists: { $in: personalPublicPlaylistsIds } } })

        // proceeding now by deleting playlists whose belong to the user
        await client.db("TuneMate").collection('playlists').deleteMany({ author: new ObjectId(userId) })

        res.json({ message: "success" })
    }
    else res.status(400).json({ message: "failed" })
    client.close()
    /*  
    
        #swagger.tags = ['User']
        #swagger.summary = 'User delete'
        #swagger.description = 'It receives the user\'s ID from cookies and proceeds to delete user\'s data and created playlists'
    
        #swagger.responses[200] = {
            description: 'The cancellation process was successful',
            schema: {
                "message": "success"
            }
        }
    
        #swagger.responses[400] = {
            description: 'Another error has occurred, the user was not deleted',
            schema: {
                "message": "failed"
            }
        }
    
        #swagger.responses[401] = {
            description: 'The user is not logged in',
            schema: {
                "message": "Login required"
            }
        }
    
    
        */

})


app.get("/genre", (req, res) => { // Get reccomended genres from Spotify. Used on signup and profile edit
    fetch(`https://api.spotify.com/v1/recommendations/available-genre-seeds`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + spotifyToken,
        }
    })
        .then((response) => response.json())
        .then(response => { res.json(response) })


    /*
    #swagger.tags = ['Data']
    #swagger.summary = 'Get reccomended genres'
    #swagger.description = 'It returns Spotify reccomended genres. It doesn\'t required auth because it is also used during the sign up process'


    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: {
            "genres": [
            "acoustic",
            "afrobeat",
            "alt-rock",
            "alternative",
            "ambient",
            "anime",
            "black-metal",
            "bluegrass"
            ]
        }
    }

    */
})

/* --- Searching for songs --- */

app.post("/search", auth, (req, res) => { // search for songs by using multiple filters. Used on song search
    const limit = 50
    const r = req.body

    if ((r.name == undefined || sanitize(r.name) == "") && (r.artist == undefined || sanitize(r.artist) == "") && (r.album == undefined || sanitize(r.album) == "") && (r.genre == undefined || sanitize(r.genre) == "") && (r.startYear == undefined || sanitize(r.startYear) == "" || r.endYear == undefined || sanitize(r.endYear) == "")) {
        res.status(400).json({ message: "You must specify at least a filter" })
    }
    else {

        let firstFilterJoined = false
        let query = ""
        if (r.name != undefined && r.name !== "") {
            query += `track:${r.name}`
            firstFilterJoined = true
        }
        if (r.album != undefined && r.album !== "") {
            if (firstFilterJoined) query += " "
            query += `album:${r.album}`
            firstFilterJoined = true
        }
        if (r.artist != undefined && r.artist !== "") {
            if (firstFilterJoined) query += " "
            query += `artist:${r.artist}`
            firstFilterJoined = true
        }
        if (r.genre != undefined && r.genre !== "") {
            if (firstFilterJoined) query += " "
            query += `genre:${r.genre}`
            firstFilterJoined = true
        }
        if (r.startYear != undefined && r.startYear !== "") {
            if (firstFilterJoined) query += " "
            query += `year:${r.startYear}-${r.endYear}`
        }
        fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + spotifyToken,
            }
        })
            .then((response) => response.json())
            .then(response => res.json(response))
    }

    /*  

    #swagger.tags = ['Data']
    #swagger.summary = 'Track search'
    #swagger.description = 'It receives information about a song such as title, artist, genre, album and date of publication. It asks for results from the Spotify API and returns the results. At least a filter is mandatory.'

    #swagger.parameters['obj'] = { 
        in: 'body', 
        description: 'Track data', 
        required: true,
        schema: { 
            $name: 'Do I Wanna Know?', 
            $artist: 'Arctic Monkeys',
            $album: 'AM',
            $genre: 'Rock',
            $startYear: '2000',
            $endYear: '2020'
        } 
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
    }

    #swagger.responses[400] = {
        description: 'At leat a filter is mandatory',
        schema: {
            "message": "You must specify at least a filter"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    */


})

/* --- Searching for artists --- */

app.get("/artist", (req, res) => { // search artists by name. This doesn't require auth because it is also used during sign up. Used on signup and profile edit
    fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(req.query.name)}&type=artist&limit=10`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + spotifyToken,
        }
    })
        .then(response => {
            response.json().then(response => res.send(response))
        })

    /*  

    #swagger.tags = ['Data']
    #swagger.summary = 'Artist search by name'
    #swagger.description = 'It returns a list of 10 artists based on the name given'

    #swagger.parameters['name'] = { 
        in: 'query', 
        description: 'Artist name', 
        required: true,
        type: 'string'
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
    }

    */
})

app.get("/artist/:id", auth, (req, res) => { // Search an artist by ID. used on song search page to show genres for each song.
    fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(req.params.id)}`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + spotifyToken,
        }
    })
        .then((response) => response.json())
        .then(response => res.json(response))

    /*  
    
        #swagger.tags = ['Data']
        #swagger.summary = 'Artist search by ID'
        #swagger.description = 'It returns an artist based on the given ID'
    
        #swagger.parameters['id'] = { 
            in: 'path', 
            description: 'Artist ID', 
            required: true,
            type: 'string'
        }
    
        #swagger.responses[200] = {
            description: 'The request was successful',
        }

        #swagger.responses[401] = {
            description: 'The user is not logged in',
            schema: {
                "message": "Login required"
            }
        }
    
    */

})

/* --- Managing playlists --- */

app.get("/playlist", mongoDBSanitize, auth, async (req, res) => { // get personal playlists + followed public playlists. Used for the profile page to show personal and followed playlists
    const id = res.locals.id

    const client = new mongoClient(mongoUri)
    try {
        const followedPlaylistsIds = (await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(id) })).followedPlaylists // retrieving followed playlists ids
        const personalPlaylists = await client.db("TuneMate").collection('playlists').find({ author: new ObjectId(id) }).toArray()
        const followedPlaylists = followedPlaylistsIds.length >= 1 ? await client.db("TuneMate").collection('playlists').find({ $and: [{ isPublic: true }, { _id: { $in: followedPlaylistsIds } }] }).toArray() : []

        for (const i of followedPlaylists) {
            i.author = await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(i.author.toString()) }, { projection: { username: 1 } })
        }

        res.send({
            personalPlaylists: personalPlaylists, // array of personal playlists (private and public playlists)
            followedPlaylists: followedPlaylists
        })
    }
    catch (err) {
        res.status(500).json({ message: "Internal server error" })
    }
    client.close()
    /*  
    
    #swagger.tags = ['Playlist']
    #swagger.summary = 'Get personal and followed playlists'
    #swagger.description = 'It returns a list of personal playlists and public ones that the user follows. It depends on the JWT token passed through the request header'

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: {
        "privatePlaylists": [
            {
            "_id": "64ac546a505552c62cd465a6",
            "name": "First playlist!",
            "description": "My first playlist",
            "tag": [
                "#leisure"
            ],
            "author": "64ac53b2505552c62cd465a5",
            "songs": [
                "5FVd6KXrgO9B3JPmC8OPst",
                "58ge6dfP91o9oXMzq3XkIS"
            ],
            "isPublic": true
            }
        ],
        "followedPlaylists": [
            {
            "_id": "64ad17595e2ffd91aec4d3cb",
            "name": "prova",
            "description": "prova",
            "tag": [
                "#d"
            ],
            "author": {
                "_id": "64a6978e96fbb79353e5028b",
                "username": "Tiz314"
            },
            "songs": [
                "0Ymjv0OJeIIPXr6s9wi3iW",
                "1R0a2iXumgCiFb7HEZ7gUE"
            ],
            "isPublic": true
            }
        ]
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[500] = {
        description: 'A different DB error has occurred',
        schema: {
            "message": "Internal server error"
        }
    }
    
    */

})

app.get("/playlist/:id", mongoDBSanitize, auth, async (req, res) => { // get a single playlist by id. Used on playlist detail page
    const userId = res.locals.id
    const playlistId = req.params.id

    if (validator.isAlphanumeric(playlistId)) {
        const client = new mongoClient(mongoUri)
        try {
            // finding a personal playlist or a public playlist with the given ID
            let result = await client.db("TuneMate").collection('playlists').findOne({ $or: [{ author: new ObjectId(userId), _id: new ObjectId(playlistId) }, { isPublic: true, _id: new ObjectId(playlistId) }] })
            if (result != null) {
                result.author = await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(result.author.toString()) }, { projection: { username: 1 } }) // retrieving author information
                // retrieving information about the playlist's songs and merging it into the final object
                const songsList = result.songs.join(",")
                const trackList = (await getSeveralTracks(songsList)).tracks // retrieving all tracks' information and joining all together
                result.songs = trackList != undefined ? trackList : []

                if (result.isPublic && userId != result.author._id.toString()) { // if the playlist is public and i'm not the author, add a piece of information about my following status
                    const followedPlaylists = (await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { followedPlaylists: 1 } })).followedPlaylists
                    for (let i = 0; i < followedPlaylists.length; i++) {
                        followedPlaylists[i] = followedPlaylists[i].toString()
                    } // retrieving an array of followed playlist by the logged user
                    if (followedPlaylists.includes(result._id.toString())) result.isFollowed = true
                    else result.isFollowed = false
                }
                if (result.isPublic) { // if the playlist is public, a follower count is added
                    const users = await client.db("TuneMate").collection('users').find({ followedPlaylists: { $all: [new ObjectId(playlistId)] } }).toArray() // retrieving all users that have this playlist id into their followedPlaylists array
                    result.followers = users.length
                }

                result.loggedUser = userId // just to compare it with the playlist author and choose the frontend interface to use
                res.send(result) // this will be a playlist owned by the logged user or a public playlist!
            } else res.status(404).json({ message: "Playlist not found!" })
        }
        catch (err) {
            res.status(404).json({ message: "Playlist not found!" })
        }
        client.close()
    }
    else res.status(400).json({ message: "Invalid ID" })
    /*  


    #swagger.tags = ['Playlist']
    #swagger.summary = 'Get a playlist by ID'
    #swagger.description = 'It returns a playlist\'s information based on the given ID'

    #swagger.parameters['id'] = { 
        in: 'path', 
        required: true,
        description: 'Playlist ID',
        type: 'string' 
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: {
            "_id": "64ac546a505552c62cd465a6",
            "name": "First playlist!",
            "description": "My first playlist",
            "tag": [
                "#leisure"
            ],
            "author": {
                "_id": "64ac53b2505552c62cd465a5",
                "username": "m4r10"
            },
            "songs": [
                {
                "album": {
                    "album_type": "album",
                    "artists": [
                    {
                        "external_urls": {
                        "spotify": "https://open.spotify.com/artist/7Ln80lUS6He07XvHI8qqHH"
                        },
                        "href": "https://api.spotify.com/v1/artists/7Ln80lUS6He07XvHI8qqHH",
                        "id": "7Ln80lUS6He07XvHI8qqHH",
                        "name": "Arctic Monkeys",
                        "type": "artist",
                        "uri": "spotify:artist:7Ln80lUS6He07XvHI8qqHH"
                    }
                    ],
                    "available_markets": [
                    "AD",
                    "AE",
                    "AG",
                    "AL"
                    ],
                    "external_urls": {
                    "spotify": "https://open.spotify.com/album/78bpIziExqiI9qztvNFlQu"
                    },
                    "href": "https://api.spotify.com/v1/albums/78bpIziExqiI9qztvNFlQu",
                    "id": "78bpIziExqiI9qztvNFlQu",
                    "images": [
                    {
                        "height": 640,
                        "url": "https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe565499163",
                        "width": 640
                    },
                    {
                        "height": 300,
                        "url": "https://i.scdn.co/image/ab67616d00001e024ae1c4c5c45aabe565499163",
                        "width": 300
                    },
                    {
                        "height": 64,
                        "url": "https://i.scdn.co/image/ab67616d000048514ae1c4c5c45aabe565499163",
                        "width": 64
                    }
                    ],
                    "name": "AM",
                    "release_date": "2013-09-09",
                    "release_date_precision": "day",
                    "total_tracks": 12,
                    "type": "album",
                    "uri": "spotify:album:78bpIziExqiI9qztvNFlQu"
                },
                "artists": [
                    {
                    "external_urls": {
                        "spotify": "https://open.spotify.com/artist/7Ln80lUS6He07XvHI8qqHH"
                    },
                    "href": "https://api.spotify.com/v1/artists/7Ln80lUS6He07XvHI8qqHH",
                    "id": "7Ln80lUS6He07XvHI8qqHH",
                    "name": "Arctic Monkeys",
                    "type": "artist",
                    "uri": "spotify:artist:7Ln80lUS6He07XvHI8qqHH"
                    }
                ],
                "available_markets": [
                    "AR",
                    "AU",
                    "AT"
                ],
                "disc_number": 1,
                "duration_ms": 272394,
                "explicit": false,
                "external_ids": {
                    "isrc": "GBCEL1300362"
                },
                "external_urls": {
                    "spotify": "https://open.spotify.com/track/5FVd6KXrgO9B3JPmC8OPst"
                },
                "href": "https://api.spotify.com/v1/tracks/5FVd6KXrgO9B3JPmC8OPst",
                "id": "5FVd6KXrgO9B3JPmC8OPst",
                "is_local": false,
                "name": "Do I Wanna Know?",
                "popularity": 91,
                "preview_url": "https://p.scdn.co/mp3-preview/006bc465fe3d1c04dae93a050eca9d402a7322b8?cid=bf61576227ef4560a75f0bf45ca0c6f3",
                "track_number": 1,
                "type": "track",
                "uri": "spotify:track:5FVd6KXrgO9B3JPmC8OPst"
                },
                {
                "album": {
                    "album_type": "album",
                    "artists": [
                    {
                        "external_urls": {
                        "spotify": "https://open.spotify.com/artist/7Ln80lUS6He07XvHI8qqHH"
                        },
                        "href": "https://api.spotify.com/v1/artists/7Ln80lUS6He07XvHI8qqHH",
                        "id": "7Ln80lUS6He07XvHI8qqHH",
                        "name": "Arctic Monkeys",
                        "type": "artist",
                        "uri": "spotify:artist:7Ln80lUS6He07XvHI8qqHH"
                    }
                    ],
                    "available_markets": [
                    "CA",
                    "US"
                    ],
                    "external_urls": {
                    "spotify": "https://open.spotify.com/album/6rsQnwaoJHxXJRCDBPkBRw"
                    },
                    "href": "https://api.spotify.com/v1/albums/6rsQnwaoJHxXJRCDBPkBRw",
                    "id": "6rsQnwaoJHxXJRCDBPkBRw",
                    "images": [
                    {
                        "height": 640,
                        "url": "https://i.scdn.co/image/ab67616d0000b2730c8ac83035e9588e8ad34b90",
                        "width": 640
                    },
                    {
                        "height": 300,
                        "url": "https://i.scdn.co/image/ab67616d00001e020c8ac83035e9588e8ad34b90",
                        "width": 300
                    },
                    {
                        "height": 64,
                        "url": "https://i.scdn.co/image/ab67616d000048510c8ac83035e9588e8ad34b90",
                        "width": 64
                    }
                    ],
                    "name": "Favourite Worst Nightmare (Standard Version)",
                    "release_date": "2007-04-24",
                    "release_date_precision": "day",
                    "total_tracks": 12,
                    "type": "album",
                    "uri": "spotify:album:6rsQnwaoJHxXJRCDBPkBRw"
                },
                "artists": [
                    {
                    "external_urls": {
                        "spotify": "https://open.spotify.com/artist/7Ln80lUS6He07XvHI8qqHH"
                    },
                    "href": "https://api.spotify.com/v1/artists/7Ln80lUS6He07XvHI8qqHH",
                    "id": "7Ln80lUS6He07XvHI8qqHH",
                    "name": "Arctic Monkeys",
                    "type": "artist",
                    "uri": "spotify:artist:7Ln80lUS6He07XvHI8qqHH"
                    }
                ],
                "available_markets": [
                    "CA",
                    "US"
                ],
                "disc_number": 1,
                "duration_ms": 253586,
                "explicit": false,
                "external_ids": {
                    "isrc": "GBCEL0700074"
                },
                "external_urls": {
                    "spotify": "https://open.spotify.com/track/58ge6dfP91o9oXMzq3XkIS"
                },
                "href": "https://api.spotify.com/v1/tracks/58ge6dfP91o9oXMzq3XkIS",
                "id": "58ge6dfP91o9oXMzq3XkIS",
                "is_local": false,
                "name": "505",
                "popularity": 83,
                "preview_url": "https://p.scdn.co/mp3-preview/24ad19af2d5feeeb0048bff59b4096960b415848?cid=bf61576227ef4560a75f0bf45ca0c6f3",
                "track_number": 12,
                "type": "track",
                "uri": "spotify:track:58ge6dfP91o9oXMzq3XkIS"
                }
            ],
            "isPublic": true,
            "followers": 1,
            "loggedUser": "64ac53b2505552c62cd465a5"
        }
    }

    #swagger.responses[400] = {
        description: 'Invalid playlist ID',
        schema: {
            "message": "Invalid ID"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[404] = {
        description: 'Playlist not found',
        schema: {
            "message": "Playlist not found!"
        }
    }


    */

})

app.get("/pubplaylist", mongoDBSanitize, auth, async (req, res) => { // It gives information about public playlists eventually filtered by name, tags and/or tracks titles. Used on public playlist search page
    const userId = res.locals.id
    const client = new mongoClient(mongoUri)

    const followedPlaylists = (await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { followedPlaylists: 1 } })).followedPlaylists
    for (let i = 0; i < followedPlaylists.length; i++) {
        followedPlaylists[i] = followedPlaylists[i].toString()
    } // retrieving an array of followed playlist by the logged user
    // forging the public playlist's filter
    const filter = {
        isPublic: true
    }
    if (req.query.name != undefined && typeof req.query.name == "string") {
        filter.name = { $regex: sanitize(req.query.name) } // looking for a case sensitive substring
    }
    if (req.query.tags != undefined && typeof req.query.tags == "string") {
        filter.tag = { $all: checkTags(sanitize(req.query.tags).split(",")) } // checking if query tags are a subset of playlist's tags, applying the tag check to improve search even for supoptimal input
    }
    if (req.query.tracks != undefined && typeof req.query.tracks == "string") {
        filter.songs = { $all: sanitize(req.query.tracks).split(",") }
    }
    const publicPlaylists = await client.db("TuneMate").collection('playlists').find(filter).toArray()


    for (const i of publicPlaylists) {
        i.author = await client.db("TuneMate").collection('users').findOne({ _id: new ObjectId(i.author.toString()) }, { projection: { username: 1 } })
        if (followedPlaylists.includes(i._id.toString())) i.followed = true
        else i.followed = false // flagging each playlist if followed
    }

    if (publicPlaylists.length >= 1) {
        res.send(publicPlaylists)
    }
    else res.status(404).json({ message: "Playlists not found!" })
    client.close()


    /*  

    #swagger.tags = ['Playlist']
    #swagger.summary = 'Get public playlists'
    #swagger.description = 'It returns all the public playlists stored in the DB with the possibility of applying filters to the search such as names, tags and songs added to playlists'

    #swagger.parameters['name'] = { 
        in: 'query', 
        description: 'Playlist name', 
        required: false,
        type: 'string'
    }
    #swagger.parameters['tags'] = { 
        in: 'query', 
        description: 'Playlist tags', 
        required: false,
        type: 'string'
    }
    #swagger.parameters['tracks'] = { 
        in: 'query', 
        description: 'Playlist tracks (id1,id2...)', 
        required: false,
        type: 'string'
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: [{
            "_id": "64ac546a505552c62cd465a6",
            "name": "First playlist!",
            "description": "My first playlist",
            "tag": [
            "#leisure"
            ],
            "author": {
            "_id": "64ac53b2505552c62cd465a5",
            "username": "m4r10"
            },
            "songs": [
            "5FVd6KXrgO9B3JPmC8OPst",
            "58ge6dfP91o9oXMzq3XkIS"
            ],
            "isPublic": true,
            "followed": false
        }]
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[404] = {
        description: 'No playlist matches filters',
        schema: {
            "message": "Playlists not found!"
        }
    }

    */


})


app.post("/playlist", mongoDBSanitize, auth, async (req, res) => { // create a new playlist. Used on the profile page

    const userId = res.locals.id
    const newPlaylist = req.body

    if (newPlaylist.name != undefined && typeof newPlaylist.name == "string" && newPlaylist.description != undefined && typeof newPlaylist.description == "string") {
        newPlaylist.name = sanitizePlaylistInfo(sanitize(newPlaylist.name))
        newPlaylist.description = sanitizePlaylistInfo(sanitize(newPlaylist.description))

        if (newPlaylist.name == undefined || typeof newPlaylist.name != "string" || newPlaylist.name.length == 0 || newPlaylist.name.length > maxTextLength) { // last condition to avoid empty strings or only spaces
            res.status(400).json({ message: "Name not accepted" })
        }
        else if (newPlaylist.description == undefined || typeof newPlaylist.description != "string" || newPlaylist.description.length == 0 || newPlaylist.description.length > maxTextLength) {
            res.status(400).json({ message: "Description not accepted" })
        }
        else if (newPlaylist.tag == undefined || !Array.isArray(newPlaylist.tag) || newPlaylist.tag.length == 0 || !isStringArray(newPlaylist.tag)) {
            res.status(400).json({ message: "Missing tags" })
        }
        else {
            newPlaylist.author = new ObjectId(userId)
            newPlaylist.tag = checkTags(newPlaylist.tag)
            newPlaylist.songs = []
            newPlaylist.isPublic = false

            const client = new mongoClient(mongoUri)
            try {
                await client.db("TuneMate").collection('playlists').insertOne(newPlaylist)
                res.json({ message: "New playlist created" })
            }
            catch (err) {
                res.status(500).json({ message: "Internal server error" })
            }
            client.close()
        }
    } else res.status(400).json({ message: "Missing information" })


    /*  
    
    #swagger.tags = ['Playlist']
    #swagger.summary = 'Create a new playlist'
    #swagger.description = 'It receives the necessary information to create a new playlist linked to the logged user'

    #swagger.parameters['obj'] = { 
        in: 'body', 
        description: 'Playlist information', 
        required: true,
        schema: {
            $name: "Coding playlist",
            $description: "Songs to code to",
            $tag: ["#coding", "#studying"]
        }
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: {
            "message": "New playlist created"
        }
    }

    #swagger.responses[400] = {
        description: 'Some mandatory information is missing',
        schema: {
            "message": "Missing <field>"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[500] = {
        description: 'A different DB error has occurred',
        schema: {
            "message": "Internal server error"
        }
    }
    
    */

})

app.put("/playlist/:id", mongoDBSanitize, auth, async (req, res) => { // update a playlist with its basic info or by adding a new song or changing its owner. All data are included in the body of the request. Used on the profile page

    const newPlaylist = req.body
    const userId = res.locals.id
    const playlistId = req.params.id
    const newData = {}

    if (newPlaylist.newSongId != undefined && typeof newPlaylist.newSongId == "string") { // update the playlist by adding a single new song, eventually
        const newSongId = encodeURIComponent(newPlaylist.newSongId)
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${newSongId}`, { // checking if the song exists
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + spotifyToken,
            }
        })
        if (trackResponse.ok) {
            const client = new mongoClient(mongoUri)
            try {
                const playlist = await client.db("TuneMate").collection('playlists').findOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) })

                if (playlist == null) {
                    res.status(400).json({ message: "The playlist is invalid" })
                }
                else if (playlist.songs.includes(newSongId)) { // the songs array in the playlist record already includes the id that was passed
                    res.status(400).json({ message: "This captivating tune is already gracing the playlist!" })
                }
                else { // the new song is added
                    await client.db("TuneMate").collection('playlists').updateOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) }, { $push: { songs: newSongId } })
                    res.json({ message: "Song added!" })
                }
            }
            catch (err) {
                res.status(500).json({ message: "Internal server error" })
            }
            client.close()
        }
        else res.status(404).json({ message: "Song not found!" })
    }
    else if (newPlaylist.oldSongId != undefined && typeof newPlaylist.oldSongId == "string") { // update the playlist by removing a single new song, eventually
        const oldSongId = encodeURIComponent(newPlaylist.oldSongId)
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${oldSongId}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + spotifyToken,
            }
        })
        if (trackResponse.ok) {

            const client = new mongoClient(mongoUri)
            try {
                let playlist = await client.db("TuneMate").collection('playlists').findOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) })
                if (playlist == null) {
                    res.status(400).json({ message: "The playlist is invalid" })
                }
                else if (!playlist.songs.includes(oldSongId)) { // the song passed was not in the playlist
                    res.status(400).json({ message: "The song is not in the playlist" })
                }
                else { // the song is removed from the playlist
                    await client.db("TuneMate").collection('playlists').updateOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) }, { $pull: { songs: oldSongId } })
                    res.json({ message: "Playlist updated" })
                }
            }
            catch (err) {
                res.status(500).json({ message: "Internal server error" })
            }
            client.close()
        } else res.status(404).json({ message: "Song not found!" })
    }
    else if (newPlaylist.tracklist != undefined && Array.isArray(newPlaylist.tracklist)) { // update the entire tracklist: used to update songs order
        const client = new mongoClient(mongoUri)
        try {
            let playlist = await client.db("TuneMate").collection('playlists').findOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) })
            if (playlist == null) {
                res.status(400).json({ message: "The playlist is invalid" })
            }
            else if (!Array.isArray(newPlaylist.tracklist)) {
                res.status(400).json({ message: "The input given is not an array" })
            }
            else {
                const tracksIdList = newPlaylist.tracklist.join(",")
                if (!(await getSeveralTracks(tracksIdList)).tracks.includes(null)) { // if any of the result song is "null", it means that the song does not exist, so the playlist is not updated!
                    await client.db("TuneMate").collection('playlists').updateOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) }, { $set: { songs: newPlaylist.tracklist } })
                    res.json({ message: "Playlist updated" })
                }
                else res.status(400).json({ message: "Some songs ID are invalid" })
            }
        }
        catch (err) {
            res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }
    else {
        // updating basic playlist information
        if (newPlaylist.name != undefined && newPlaylist.name !== "" && newPlaylist.name.length > 0 && newPlaylist.name.length <= maxTextLength) {
            newData.name = sanitizePlaylistInfo(sanitize(newPlaylist.name))
        }
        else {
            res.status(400).json({ message: "Invalid name" })
            return
        }
        if (newPlaylist.description != undefined && newPlaylist.description !== "" && newPlaylist.description.length > 0 && newPlaylist.description.length <= maxTextLength) {
            newData.description = sanitizePlaylistInfo(sanitize(newPlaylist.description))
        }
        else {
            res.status(400).json({ message: "Invalid description" })
            return
        }
        if (newPlaylist.tag != undefined && Array.isArray(newPlaylist.tag) && newPlaylist.tag.length >= 1 && isStringArray(newPlaylist.tag)) {
            newData.tag = checkTags(newPlaylist.tag)
        }
        else {
            res.status(400).json({ message: "Invalid tags" })
            return
        }
        if (newPlaylist.isPublic != undefined && typeof newPlaylist.isPublic == "boolean") {
            newData.isPublic = newPlaylist.isPublic
            if (!newData.isPublic) { // here removing the newly private playlist from the followed array of other users
                const client = new mongoClient(mongoUri)
                await client.db("TuneMate").collection("users").updateMany({}, { $pull: { followedPlaylists: new ObjectId(playlistId) } })
                client.close()
            }
        }
        else {
            res.status(400).json({ message: "Invalid visibility" })
            return
        }
        if (newPlaylist.newOwner != undefined && typeof newPlaylist.newOwner == "string") {
            const userCheck = new mongoClient(mongoUri)
            const possiblyNewOwnerId = sanitize(newPlaylist.newOwner)
            try {
                const result = await userCheck.db("TuneMate").collection('users').findOne({ _id: new ObjectId(possiblyNewOwnerId) })
                if (result != null) {
                    newData.author = new ObjectId(possiblyNewOwnerId)
                    await userCheck.db("TuneMate").collection("users").updateOne({ _id: new ObjectId(possiblyNewOwnerId) }, { $pull: { followedPlaylists: new ObjectId(playlistId) } }) // eventually removing from the future owner the eventually followed playlist.  
                }
            }
            catch (err) {
                res.status(500).json({ message: "Internal server error" }) // if something bad happened during usercheck, then it can't continue
                return
            }
            userCheck.close()
        }


        const client = new mongoClient(mongoUri)
        try {
            await client.db("TuneMate").collection('playlists').updateOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) }, { $set: newData }) // if the user trying to change information is not the author, nothing is changed (thx to the filter by author id)
            res.json({ message: "Playlist updated" })
        }
        catch (err) {
            res.status(500).json({ message: "Internal server error" })
        }
        client.close()
    }

    /*  

    #swagger.tags = ['Playlist']
    #swagger.summary = 'Playlist update'
    #swagger.description = 'It updates a playlist based on the ID given. It is possible to update the playlist\'s basic information (including the author of the playlist); add a new song; or remove an old song. As for the user update, it is possible to perform one of the three actions at a time. The tracklist field accepts an array of strings which will replace the playlist tracklist. It is used to update the tracklist order.'

    #swagger.parameters['id'] = { 
        in: 'path', 
        description: 'Playlist ID', 
        required: true,
        type: 'string'
    }

    #swagger.parameters['obj'] = { 
        in: 'body', 
        description: 'Playlist data', 
        required: true,
        schema: { 
            $name: "Coding playlist",
            $description: "Songs to code to",
            $tag: ["#coding", "#studying"], 
            $isPublic: true,
            $newOwner: '64a6978e96fbb79353e5028b',
            $newSongId: '58ge6dfP91o9oXMzq3XkIS',
            $oldSongId: '58ge6dfP91o9oXMzq3XkIS',
            $tracklist: ['58ge6dfP91o9oXMzq3XkIS']
        } 
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema:{
            "message": "Playlist updated"
        }
    }

    #swagger.responses[400] = {
        description: 'Any input field is invalid. The message content depends on the field',
        schema: {
            "message": "<field> is invalid"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[404] = {
        description: 'When adding or removing a song, the given song ID is invalid',
        schema: {
            "message": "Song not found!"
        }
    }

    #swagger.responses[500] = {
        description: 'A different DB error has occurred',
        schema:{
            "message": "Internal server error"
        }
    }

    */

})

app.delete("/playlist/:id", mongoDBSanitize, auth, async (req, res) => { // Delete a playlist specifying its ID. Used on the profile page

    const userId = res.locals.id
    const playlistId = validator.escape(req.params.id) // this must be defined if route is chosen by Express, so validator is applied here

    const client = new mongoClient(mongoUri)
    try {
        let result = await client.db("TuneMate").collection("playlists").deleteOne({ author: new ObjectId(userId), _id: new ObjectId(playlistId) }) // deleting the single playlist
        if (result.deletedCount == 1) {
            await client.db("TuneMate").collection("users").updateMany({}, { $pull: { followedPlaylists: new ObjectId(playlistId) } }) // eventually removing the playlist from the followed one. If the playlist was private, nothing will change
            res.json({ message: "success" })
        } else res.status(400).json({ message: "failed" })
    }
    catch (err) {
        res.status(500).json({ message: "Internal server error" })
    }
    client.close()

    /*  

    #swagger.tags = ['Playlist']
    #swagger.summary = 'Playlist delete'
    #swagger.description = 'It deletes the playlist from the DB whose ID is passed'

    #swagger.parameters['id'] = { 
        in: 'path', 
        description: 'Playlist ID', 
        required: true,
        type: 'string'
    }

    #swagger.responses[200] = {
        description: 'The request was successful',
        schema: {
            "message": "success"
        }
    }

    #swagger.responses[400] = {
        description: 'The given id is invalid',
        schema: {
            "message": "failed"
        }
    }

    #swagger.responses[401] = {
        description: 'The user is not logged in',
        schema: {
            "message": "Login required"
        }
    }

    #swagger.responses[500] = {
        description: 'A different DB error has occurred',
        schema: {
            "message": "Internal server error"
        }
    }

    */

})

app.get("/up", (req, res) => { // Server status check
    res.status(418).json({ message: "I'm up, but i can't brew coffee!" })

    /*  

    #swagger.tags = ['Test']
    #swagger.summary = 'Server status check'
    #swagger.description = 'If a response is received, the server is up and running, but since it\'s a teapot it can\'t brew coffee'
    
    */

})



app.get("*", (req, res) => { // If any of the resources is requested, then the page could not be found
    res.status(404).sendFile(path.join(__dirname, 'public/not_found.html'));
})

app.listen(8080, "0.0.0.0", () => {
    console.log("Started on 8080")
})


function getSpotifyToken() {
    fetch(spotifyUrl, {
        method: "POST",
        headers: {
            Authorization: "Basic " + btoa(`${process.env.CLIENTID}:${process.env.CLIENTSECRET}`),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
    })
        .then((response) => response.json())
        .then((tokenResponse) => {
            spotifyToken = tokenResponse.access_token
        })
}

function getUserCookie(req) { // to retrievce thes user's JWT token
    let receivedToken = req.headers.cookie
    if (receivedToken != undefined) {
        receivedToken = req.headers.cookie.split("; ")
        for (const i of receivedToken) {
            if (i.substring(0, 4) === "user") {
                return i.split("=")[1]
            }
        }
    }
    else return undefined
}

function jwtVerify(token) {
    try {
        return jwt.verify(token, process.env.JWTSECRET)
    } catch (err) {
        return ""
    }
}

function jwtSign(user) {
    return jwt.sign(user, process.env.JWTSECRET, { expiresIn: '1h' });
}

function hash256(input) {
    return crypto.SHA256(input).toString(crypto.enc.Hex)
}

function auth(req, res, next) {
    let receivedToken = getUserCookie(req)
    if (receivedToken != undefined) {
        const decoded = jwtVerify(receivedToken)
        if (decoded.username != undefined && !usernameBlacklist.includes(decoded.username)) {
            res.locals.username = decoded.username // to share the username to the next function
            res.locals.id = decoded.id
            next()
        }
        else res.status(401).json({ message: "Login required" })
    }
    else res.status(401).json({ message: "Login required" })
}

async function getSeveralTracks(tracks) {
    return await (await fetch(`https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(tracks)}`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + spotifyToken,
        }
    })).json()
}

function sanitize(input) {
    return validator.trim(input).replace(/\s+/g, ' '); // to remove whitespaces from left and right and duplicated whitespaces. Here i can't escape ' and " because of the UX
}

function isStringArray(arr) { // check if array contains only strings
    return arr.every(i => typeof i === "string")
}

function removeSpecialChars(input) { // to remove special chars from tags
    return input.replace(/[&\/\\#,+()$~%.'":*?<>{}^`]/g, "")
}

function sanitizePlaylistInfo(input) { // to sanitize only prohibited chars in playlists' info. It is possible to insert " and ' chars, for example.
    return input.replace(/[&\/\\$%.*<>{}^`]/g, "")
}

function checkTags(list) {
    list.forEach((element, index) => { // checking if every tag includes the # char. If not, the char is added server side
        let newTag = sanitize(element.replace(/#/g, ""))
        newTag = removeSpecialChars(newTag.replace(/ /g, "_"))
        list[index] = `#${newTag}` // sanitize to avoid tags like # tagname and replacing spaces with _
    })
    list = Array.from(new Set(list))
    list = list.filter((element) => element.length > 1)
    return list
}