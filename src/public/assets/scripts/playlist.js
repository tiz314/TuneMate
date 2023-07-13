let plData = null // in order to be able to retrieve data for the edit modal more easily, without the needing of retrieving data by the elements' innerText

let draggables = [] // array of draggable songs
let songContainers = [] // array of draggable songs containers 

let songOrder = [] // the song order, updated by dragends



async function loadPlaylistData() { // it manages the playlist details' page loading. This means that this function covers pages for private playlists and also public ones that are owned or not, managing their appearence and layout.

    const urlParams = new URLSearchParams(window.location.search)
    const playlistId = urlParams.get("p")

    if (playlistId == null) location.replace("/")
    else {
        // loading basic playlist's info
        fetch(`/playlist/${playlistId}`).then(res => { // loading playlist's data
            document.getElementsByClassName("loadingSpinner")[0].classList.add("d-none")
            if (res.ok) {
                res.json().then((res) => {
                    plData = res // playlist data. This is necessary to retrieve the same data

                    const authorId = plData.author._id.toString() // getting the author id. This is necessary to understand if the logged user is also the author of the playlist (the combination not author/private playlist was already check in the backend)
                    if (plData.loggedUser === authorId) document.getElementById("playlistEditModalButton").classList.remove("d-none")
                    document.title = `TuneMate | ${plData.name}`
                    document.getElementById("playlistName").innerText = plData.name
                    document.getElementById("playlistDescription").innerText = plData.description
                    document.getElementById("playlistTags").innerText = plData.tag.join(", ")

                    document.getElementById("playlistAuthor").innerText = `Created by ${plData.author.username}`
                    if (plData.isPublic) { // setting the followers counter
                        document.getElementById("playlistFollowers").innerText = plData.followers == 1 ? `${plData.followers} follower` : `${plData.followers} followers`
                    }
                    document.getElementById("playlistVisibility").innerHTML = plData.isPublic ?
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-unlock me-1" viewBox="0 0 16 16">
    <path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2zM3 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H3z"/>
  </svg> Public` :
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock me-1" viewBox="0 0 16 16">
    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
  </svg> Private`

                    const songsContainer = document.getElementById("playlistUserContent")
                    if (plData.loggedUser === authorId) document.getElementById("addSongToPlaylistButton").classList.remove("d-none")

                    if (plData.isFollowed != undefined) { // if isFollower is defined, it means that the playlist is public and i am not the author. This check was already done by the backend. This check can also be used up here instead of the author id check, but it is not used for code clarity
                        document.getElementById("followingButtonContainer").classList.remove("d-none")
                        if (plData.isFollowed) {
                            document.getElementById("followingButtonContainer").innerHTML = `<button type="button" class="btn mainButton" onclick="unfollowPlaylist('${plData._id.toString()}')">Unfollow</button>`
                        }
                        else document.getElementById("followingButtonContainer").innerHTML = `<button type="button" class="btn mainButton" onclick="followPlaylist('${plData._id.toString()}')">Follow</button>`

                    }
                    if (plData.songs.length >= 1) { // if there are songs to be shown, then proceeds to fill elements

                        songsContainer.classList.remove("d-none")
                        const songCard = document.getElementsByClassName("songContainer")[0].cloneNode(true)
                        songCard.classList.remove("d-none")
                        songsContainer.innerHTML = ""

                        let totalTime = 0

                        for (const i of res.songs) {

                            const newClone = songCard.cloneNode(true)
                            newClone.getElementsByClassName("playlistSong")[0].id = i.id
                            songOrder.push(i.id) // adding each ID to the global array to be altered later if song order is modified

                            newClone.getElementsByTagName("img")[0].src = i.album.images[0].url
                            newClone.getElementsByTagName("h4")[0].innerText = i.name

                            let artists = ""
                            for (const l of i.artists) {
                                artists += `${l.name}, `
                            }
                            artists = artists.substring(0, artists.length - 2)
                            newClone.getElementsByTagName("h5")[0].innerText = artists
                            totalTime += i.duration_ms

                            newClone.getElementsByTagName("h6")[0].innerHTML = `Duration: <span class='highlight'>${millisToMinutesAndSeconds(i.duration_ms)}</span>`
                            newClone.getElementsByTagName("h6")[1].innerText = `Release date: ${i.album.release_date}`

                            if (i.preview_url != null) { // eventually adding audio preview
                                newClone.getElementsByTagName("audio")[0].src = i.preview_url
                                newClone.getElementsByTagName("audio")[0].classList.remove("d-none")
                            }
                            else {
                                newClone.getElementsByTagName("audio")[0].src = ""
                                newClone.getElementsByTagName("audio")[0].classList.add("d-none")
                            }

                            if (plData.loggedUser === plData.author._id.toString()) newClone.getElementsByClassName("deleteSong")[0].innerHTML = `<button class="btn mainButton" onclick="removeSongFromPlaylist('${playlistId}', '${i.id}')">Remove</button>`

                            songsContainer.appendChild(newClone)
                        }
                        document.getElementById("playlistInfo").innerText = `${res.songs.length} songs • ${millisToMinutesAndSeconds(totalTime)} minutes` // adding final calculated information about the playlist
                    }

                    if (plData.loggedUser === authorId) { // if the logged user is the author, he will be able to drag&drop songs and change their order

                        draggables = document.getElementsByClassName("playlistSong") // retrieving all draggable songs, once loaded
                        songContainers = document.getElementsByClassName("songContainer") // retrieving all song containers

                        for (const i of draggables) {
                            i.draggable = "true"
                            i.style.cursor = "move"
                            i.getElementsByTagName("svg")[0].classList.remove("d-none")
                            i.addEventListener("dragstart", () => {
                                i.classList.add("dragging")
                                newSongDraggedContainer = i.parentNode // necessarily global to be reached in other event listener's callbacks. Here i'm storing every possible song container
                                newSongDragged = i // here i'm storing every song card
                            })
                            i.addEventListener("dragend", () => {
                                i.classList.remove("dragging")
                                containerOvered.appendChild(i) // appending the dragged song on the overed container
                                const oldSongIndex = songOrder.indexOf(containerOvered.getElementsByClassName("playlistSong")[0].id) // retrieving the index of the old song in the overed container
                                newSongDraggedContainer.appendChild(containerOvered.getElementsByClassName("playlistSong")[0]) // putting the old song in the old container of the dragged song
                                document.getElementById("applyChangeToOrder").classList.remove("d-none") // show the apply changes button


                                //then, supdating song's order array
                                const newSongIndex = songOrder.indexOf(i.id)

                                let swap = songOrder[newSongIndex]

                                songOrder[newSongIndex] = songOrder[oldSongIndex]
                                songOrder[oldSongIndex] = swap

                            })
                        }

                        for (const i of songContainers) {
                            i.addEventListener("dragover", () => {
                                i.classList.add("containerOvered")
                                containerOvered = document.getElementsByClassName("containerOvered")[0] // updating which container is overed at the moment, to be used at a dragend event
                            })
                        }

                        for (const i of songContainers) {
                            i.addEventListener("dragleave", () => {
                                i.classList.remove("containerOvered")
                            })
                        }
                    }
                })
            }
            else { // if the playlist is not found or any other error occurred.
                const playlistErrorAlert = document.getElementById("playlistErrorAlert")
                playlistErrorAlert.classList.remove("d-none")
                document.title = `TuneMate | Playlist`
                res.json().then(res => playlistErrorAlert.innerText = res.message)
            }
        })
    }
}


function playlistEdit() { // fill playlist edit modal
    document.getElementById("editName").value = plData.name
    document.getElementById("editDescription").value = plData.description
    for (const i of plData.tag) { // adding received tags as pills into the modal
        addTag(i)
    }
    document.getElementById("isPublicSwitch").checked = plData.isPublic
}

async function removeSongFromPlaylist(playlistId, songId) { // called by each remove button, dinamically created at "loadPlaylistData" function
    const newPlaylist = { oldSongId: songId }
    fetch(`/playlist/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylist)
    }).then(() => location.reload())
}

function updatePlaylist() {
    const newPlaylist = {
        name: document.getElementById("editName").value,
        description: document.getElementById("editDescription").value,
        tag: chosenTags,
        isPublic: document.getElementById("isPublicSwitch").checked,
        newOwner: document.getElementById("userId").value
    }

    fetch(`/playlist/${plData._id.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylist)
    }).then(response => {
        if (response.ok) {
            location.reload()
        } else {
            const errorAlert = document.getElementById("editErrorAlert")
            errorAlert.classList.remove("d-none")
            response.json()
                .then(err => {
                    errorAlert.innerText = err.message
                })
        }
    })

}

function confirmPlaylistDelete() {
    document.getElementById("confirmPlaylistDeleteContainer").innerHTML = `<button type="button" class="btn mainButton" id="deleteUserButton" onclick="deletePlaylist()">Are you sure?</button><p class="mt-3">This operation is irreversible</p>`
}

function resetEditPlaylistModalAlerts() {
    document.getElementById("confirmPlaylistDeleteContainer").innerHTML = `<button type="button" class="btn mainButton" id="deleteUserButton" onclick="confirmPlaylistDelete()">Delete playlist</button>`
    document.getElementById("editErrorAlert").classList.add("d-none")
}
document.getElementById("playlistEditModal").addEventListener("hidden.bs.modal", resetEditPlaylistModalAlerts) // to eventually reset alerts when the modal is closed


function deletePlaylist() {
    fetch(`/playlist/${plData._id.toString()}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
    }).then(() => {
        location.replace("/profile.html")
    })
}


function followPlaylist(playlistId) {
    const newPlaylistFollowed = {
        newPlaylistId: playlistId
    }
    fetch(`/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylistFollowed)
    }).then(() => {
        location.reload()
    })
}

function unfollowPlaylist(playlistId) {
    const oldPlaylistFollowed = {
        oldPlaylistId: playlistId
    }
    fetch(`/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oldPlaylistFollowed)
    }).then(() => {
        location.reload()
    })
}

function updateSongsOrder() {
    fetch(`/playlist/${plData._id.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracklist: songOrder })
    }).then(() => {
        location.reload()
    })
}

function fillUserChangeOwner() {
    const users = document.getElementById("users")
    if (users.value !== "") {
        fetch(`/user?username=${users.value}`).then(res => { // autocompleting changeOwner form at the update button click
            if (res.ok) {
                res.json().then(user => {
                    users.value = user.username
                    document.getElementById("userId").value = user._id.toString()
                    users.placeholder = "Username"
                })
            }
            else {
                users.value = ""
                users.placeholder = "No results!"
            }
        })
    }
}