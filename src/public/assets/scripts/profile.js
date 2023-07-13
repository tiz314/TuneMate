let userData = null // to be filled with user data. It makes edit modal fill easier than retrieving data from document.

function loadUserData() {
    fetch("/user").then(response => {
        if (response.ok) {
            response.json().then(res => {

                document.getElementsByClassName("loadingSpinner")[0].classList.add("d-none")
                document.getElementById("userEditModalButton").classList.remove("d-none")
                document.getElementById("searchPublicButton").classList.remove("d-none")
                userData = res

                document.getElementById("profileUsername").innerHTML = `${res.name} ${res.surname} (Also known as <span class='highlight'>${res.username}</span>)`
                document.getElementById("profileEmail").innerText = res.email
                document.getElementById("profileJoined").innerText = `Joined ${res.joinDate}`
                document.getElementById("profileGenres").innerHTML = `Your genres: <b>${res.genres.join(", ")}</b>`
                document.getElementById("profileArtists").innerHTML = `Your favourite artists: <b>${res.artists.join(", ")}</b>`
            })
        }
        else location.replace("/")
    })
    loadPersonalPlaylists() // load personal playlists
}

function loadPersonalPlaylists() {
    fetch("/playlist").then(response => {
        if (response.ok) {
            response.json().then(res => {
                const cardClone = document.getElementsByClassName("playlistCard")[0].cloneNode(true)
                const personalPlaylistsContainer = document.getElementById("personalPlaylistsContainer")
                personalPlaylistsContainer.innerHTML = "" // clearing from previous data

                for (const i of res.personalPlaylists) {

                    let newClone = cardClone.cloneNode(true)
                    newClone.getElementsByClassName("card")[0].classList.remove("d-none")


                    newClone.getElementsByTagName("p")[0].innerHTML = i.isPublic ?
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-unlock me-1" viewBox="0 0 16 16">
                        <path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2zM3 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H3z"/>
                      </svg> Public` :
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock me-1" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                      </svg> Private`

                    newClone.getElementsByTagName("h5")[0].innerText = i.name

                    newClone.getElementsByTagName("p")[1].innerText = i.description
                    newClone.getElementsByTagName("p")[2].innerText = i.tag.join(", ")

                    newClone.getElementsByTagName("a")[0].href = `/playlist.html?p=${i._id.toString()}`

                    personalPlaylistsContainer.appendChild(newClone)
                }

                const playlistFollowingContainer = document.getElementById("playlistFollowingContainer")
                playlistFollowingContainer.innerHTML = "" // clearing from previous data

                for (const i of res.followedPlaylists) {

                    let newClone = cardClone.cloneNode(true)
                    newClone.getElementsByClassName("card")[0].classList.remove("d-none")


                    newClone.getElementsByTagName("p")[0].innerHTML = i.isPublic ?
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-unlock me-1" viewBox="0 0 16 16">
                        <path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2zM3 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H3z"/>
                      </svg> Public` :
                        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock me-1" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                      </svg> Private`

                    newClone.getElementsByTagName("h5")[0].innerText = i.name

                    newClone.getElementsByTagName("p")[1].innerText = i.description
                    newClone.getElementsByTagName("p")[2].innerText = i.tag.join(", ")

                    newClone.getElementsByTagName("a")[0].href = `/playlist.html?p=${i._id.toString()}`

                    playlistFollowingContainer.appendChild(newClone)
                }
            })
        }
        else location.replace("/")
    })
}

function userEdit() { // prefill edit box
    document.getElementById("editName").value = userData.name
    document.getElementById("editSurname").value = userData.surname
    document.getElementById("editDate").value = userData.date
    for (const i of userData.genres) {
        addGenre(i) // filling genres and artists pills in the user edit modal. This will use the genres.js and artists.js for adding and removing elements
    }
    for (const i of userData.artists) {
        addArtist(i)
    }
    document.getElementById("editEmail").value = userData.email
    document.getElementById("editUsername").value = userData.username
}

function updateProfile() {
    const newUser = {
        name: document.getElementById("editName").value,
        surname: document.getElementById("editSurname").value,
        date: document.getElementById("editDate").value,
        genres: chosenGenres,
        artists: chosenArtists,
        email: document.getElementById("editEmail").value,
        username: document.getElementById("editUsername").value,
        password: document.getElementById("editPassword").value
    }
    fetch(`/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
    }).then(response => {
        if (response.ok) {
            location.reload()
        } else {
            const errorAlert = document.getElementById("editErrorAlert")
            errorAlert.classList.remove("d-none")
            response.json()
                .then(err => {
                    errorAlert.innerHTML = err.message
                })
        }
    })
}


function confirmUserDelete() {
    document.getElementById("userDeleteContainer").innerHTML = `<button type="button" class="btn mainButton" id="deleteUserButton" onclick="deleteUser()">Are you sure?</button>
    <p class="mt-3" >This will delete all the user's information, including playlists</p>`
}

function resetUserEditModalAlerts() {
    document.getElementById("userDeleteContainer").innerHTML = `<button type="button" class="btn mainButton" id="deleteUserButton"
    onclick="confirmUserDelete()">Delete
    user</button>`
    document.getElementById("editErrorAlert").classList.add("d-none")
}

document.getElementById("userEditModal").addEventListener("hidden.bs.modal", resetUserEditModalAlerts) // to eventually reset alerts when the modal is closed

function deleteUser() {
    fetch(`/user`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
    }).then(response => {
        if (response.ok) {
            location.replace("/")
        }
    })
}

function createPlaylist() {
    document.getElementById("createPlaylistButton").disabled = true
    const newPlaylist = {
        name: document.getElementById("playlistNameTextField").value,
        description: document.getElementById("playlistDescription").value,
        tag: chosenTags // it comes from tags.js
    }

    fetch(`/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaylist)
    }).then(response => {
        if (response.ok) {
            location.reload() // if the playlist is succesfully created, page is reloaded
        } else {
            document.getElementById("createPlaylistButton").disabled = false
            const errorAlert = document.getElementById("newPlaylistErrorAlert")
            errorAlert.classList.remove("d-none")
            response.json()
                .then(err => {
                    errorAlert.innerHTML = err.message
                })
        }
    })
}
