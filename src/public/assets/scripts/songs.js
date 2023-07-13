let pagesNumber = 0 // number of results pages
let currentPage = 0
const songPerPage = 10

let lastResponse = null // to track the last response and avoid making another query when changing the page

function searchSong() {
    currentPage = 0 // resetting page number
    const searchParams = {
        name: document.getElementById("songTextField").value,
        artist: document.getElementById("artistTextField").value,
        album: document.getElementById("albumTextField").value,
        genre: document.getElementById("genreTextField").value,
        startYear: document.getElementById("startYear").value,
        endYear: document.getElementById("endYear").value
    }
    fetch("/search", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
    }).then(res => {
        if (res.ok) {
            const songErrorAlert = document.getElementById("songErrorAlert")

            res.json().then(response => {
                lastResponse = response


                if (response.tracks != undefined && response.tracks.items.length >= 1) {
                    songErrorAlert.classList.add("d-none")
                    pagesNumber = Math.round(response.tracks.items.length / songPerPage) - 1 // to adjust the result to the counting starting from 0
                    loadSongPage(response)
                }
                else {
                    songErrorAlert.innerText = "No songs found!"
                    songErrorAlert.classList.remove("d-none")
                }
            })
        }
        else {
            const alert = document.getElementById("songErrorAlert")
            res.json().then(content => alert.innerHTML = content.message)
            alert.classList.remove("d-none")
        }
    })
}

async function loadSongPage(response) { // loading an entire page of songs
    let cardClone = document.getElementsByClassName("songCard")[0].cloneNode(true) // cloning the single card. This could contain previous data
    let cardContainer = document.getElementById("songContainer") // cloning the card cointainer. This could be full of previous results

    document.getElementsByClassName("loadingSpinner")[0].classList.remove("d-none")
    // creating playlist dropdown
    const playlists = await (await fetch("/playlist")).json()
    document.getElementsByClassName("loadingSpinner")[0].classList.add("d-none")
    document.getElementById("songNavigator").classList.remove("d-none")

    document.getElementById("songNavigator").classList.remove("d-none")

    cardContainer.innerHTML = "" // clearing from previous data

    for (let i = currentPage * songPerPage; i < songPerPage * (currentPage + 1) && i < response.tracks.items.length; i++) {

        let newClone = cardClone.cloneNode(true) // cloning the card to be filled. The clone is necessary to be able to appendChild later
        newClone.getElementsByClassName("card")[0].classList.remove("d-none")

        newClone.getElementsByTagName("img")[0].src = response.tracks.items[i].album.images[0].url
        newClone.getElementsByTagName("h5")[0].innerText = response.tracks.items[i].name

        let artists = ""
        for (const l of response.tracks.items[i].artists) {
            artists += `${l.name}, `
        }

        artists = artists.substring(0, artists.length - 2)
        newClone.getElementsByTagName("p")[0].innerText = artists
        newClone.getElementsByTagName("p")[1].innerText = (await (await fetch(`/artist/${response.tracks.items[i].artists[0].id}`)).json()).genres.join(", ")
        newClone.getElementsByTagName("p")[2].innerHTML = `Duration: <span class='highlight'>${millisToMinutesAndSeconds(response.tracks.items[i].duration_ms)}</span>`
        newClone.getElementsByTagName("p")[3].innerText = `Release date: ${response.tracks.items[i].album.release_date}`

        if (response.tracks.items[i].preview_url != null) {
            newClone.getElementsByTagName("audio")[0].src = response.tracks.items[i].preview_url
            newClone.getElementsByTagName("audio")[0].classList.remove("d-none")
        }
        else {
            newClone.getElementsByTagName("audio")[0].src = ""
            newClone.getElementsByTagName("audio")[0].classList.add("d-none")
        }

        let dropdownItems = ""
        for (const l of playlists.personalPlaylists) { // adding the playlist dropdown for each song card
            dropdownItems += `<li><button class="btn dropdown-item" onclick="addSongToPlaylist('${l._id.toString()}', '${response.tracks.items[i].id}')">${l.name}</button></li>`
        } // generating the dropdown. It'll be the same for each song (check for the same song in a playlist later) except for the onclick parameters

        newClone.getElementsByClassName("songPlaylistAddDropdown")[0].innerHTML = dropdownItems // inserting prefilled li in the dropdown. Clone is necessary to appendChild

        cardContainer.appendChild(newClone)
    }
}

async function addSongToPlaylist(playlistId, songId) {
    const newPlaylist = { newSongId: songId }
    fetch(`/playlist/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylist)
    }).then(res => {
        const answerToast = document.getElementById("addedSongToast")
        res.json().then(res => {
            answerToast.getElementsByTagName("strong")[0].innerText = res.message
        })
        const toastBootstrap = bootstrap.Toast.getOrCreateInstance(answerToast)
        toastBootstrap.show()
    })
}



/* --- Utilities functions --- */


function previousSongPage() {
    if (currentPage > 0) {
        document.getElementById("nextButton").disabled = false
        currentPage--
        document.getElementById("prevButton").disabled = true
        loadSongPage(lastResponse).then(() => {
            if (currentPage != 0) document.getElementById("prevButton").disabled = false
        })
    }
    else {
        document.getElementById("prevButton").disabled = true
    }
}

function nextSongPage() {
    if (currentPage < pagesNumber) {
        document.getElementById("prevButton").disabled = false
        currentPage++
        document.getElementById("nextButton").disabled = true
        loadSongPage(lastResponse).then(() => {
            if (currentPage != pagesNumber) document.getElementById("nextButton").disabled = false
        })
    }
    else {
        document.getElementById("nextButton").disabled = true
    }
}