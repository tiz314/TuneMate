const chosenTracks = [] // managing chosen tracks to filter results. It makes easier to manage the information instead of retrieving it from document.
const tracksDropdown = document.getElementById("tracksDropdown")
const chosenTracksList = document.getElementById("chosenTracksList")

function fillTrackList() { // updating the tracks dropdown and the update button press
    document.getElementById("fillTrackListButton").disabled = true
    const input = document.getElementById("trackTextField").value
    if (input !== "") {
        tracksDropdown.innerHTML = "" // preparing the dropdown to be filled
        fetch("/search", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: input })
        }).then(res => {
            res.json().then(res => {
                document.getElementById("fillTrackListButton").disabled = false
                if (res.tracks != undefined) {
                    let counter = 0
                    for (let i = 0; i < res.tracks.items.length && i < 10; i++) {
                        let result = `${res.tracks.items[i].name} - ${res.tracks.items[i].artists[0].name}`
                        result = result.length > 40 ? (result.replace("'", "")).substring(0, 40) + "..." : (result.replace("'", "")).substring(0, 40)
                        tracksDropdown.innerHTML += `<li id="genreItem"><button class="btn dropdown-item" onclick="addSongToTrackList('${res.tracks.items[i].id}', '${result}')">${result}</button></li>`
                        counter++
                    }

                    if (counter == 0) {
                        tracksDropdown.innerHTML = `<li id="genreItem"><button class="btn dropdown-item">Nothing to show</button></li>`
                    }
                } else tracksDropdown.innerHTML = `<li id="genreItem"><button class="btn dropdown-item">Nothing to show</button></li>`
            })
        })
    } else {
        document.getElementById("fillTrackListButton").disabled = false
        tracksDropdown.innerHTML = `<li id="genreItem"><button class="btn dropdown-item">Nothing to show</button></li>`
    }
}

function addSongToTrackList(trackId, trackName) {
    if (!chosenTracks.includes(trackId)) {
        chosenTracksList.innerHTML += `<div class="col-auto m-2" id="${trackId}">
                                            <button class="btn btn-secondary" onclick="removeSongFromTrackList('${trackId}')">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x me-1" viewBox="0 0 16 16">
                                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                            </svg>
                                            ${trackName}
                                            </button>
                                        </div>`
        chosenTracks.push(trackId)
    }
}

function removeSongFromTrackList(trackId) {
    if (chosenTracks.includes(trackId)) {
        chosenTracks.splice(chosenTracks.indexOf(trackId), 1)
        document.getElementById("chosenTracksList").removeChild(document.getElementById(trackId))
    }
}

function searchPublicPlaylists() {
    document.getElementById("pubPlaylistLoadingSpinner").classList.remove("d-none")
    const alert = document.getElementById("playlistErrorAlert")
    alert.classList.add("d-none")
    const name = document.getElementById("playlistNameTextField").value
    const tags = chosenTags.join(",")
    const tracks = chosenTracks.join(",")
    let uri = `/pubplaylist`
    let firstFilterJoined = false
    if (name !== "") { // forging the filter query
        uri += `?name=${name}`
        firstFilterJoined = true
    }
    if (tags !== "") {
        if (!firstFilterJoined) {
            uri += `?`
            firstFilterJoined = true
        }
        else uri += `&`
        uri += `tags=${tags.replace(", ", ",")}`
    }
    if (tracks !== "") {
        if (!firstFilterJoined) {
            uri += `?`
        }
        else uri += `&`
        uri += `tracks=${tracks}`
    }
    fetch(uri).then(res => {
        document.getElementById("pubPlaylistLoadingSpinner").classList.add("d-none")
        const playlistContainer = document.getElementById("playlistsContainer")
        const pubPlaylistCard = document.getElementsByClassName("pubPlaylistCard")[0].cloneNode(true)
        if (res.ok) {
            res.json().then(res => { // filling the playlist container with cards

                playlistContainer.innerHTML = ""
                for (const i of res) {
                    const newClone = pubPlaylistCard.cloneNode(true)
                    newClone.classList.remove("d-none")
                    newClone.getElementsByTagName("h5")[0].innerText = i.name
                    newClone.getElementsByTagName("p")[0].innerText = i.author.username
                    newClone.getElementsByClassName("card-footer")[0].innerHTML = `<p class="card-text"></p><p class="card-text"></p><a href="./playlist.html?p=${i._id.toString()}" class="btn mainButton">Find out more</a>`
                    newClone.getElementsByTagName("p")[1].innerText = i.description
                    newClone.getElementsByTagName("p")[2].innerText = i.tag.join(", ")
                    if (i.followed) newClone.getElementsByClassName("card")[0].style.borderColor = "#43ECBC"
                    else newClone.getElementsByClassName("card")[0].style.borderColor = "#252525"
                    playlistContainer.appendChild(newClone)
                }
            })
        }
        else {
            res.json().then(res => { // no playlists found!
                playlistContainer.innerHTML = ""
                pubPlaylistCard.classList.add("d-none")
                playlistContainer.appendChild(pubPlaylistCard)
                alert.classList.remove("d-none")
                alert.innerText = res.message
                alert.classList.remove("d-none")
                alert.innerText = res.message
            })
        }
    })
}