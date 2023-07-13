const chosenArtists = []
const artistsDropdown = document.getElementById("artistsDropdown")
const chosenArtistsList = document.getElementById("chosenArtistsList")


function fillArtistsList() { // Filling the artists' dropdown
    const input = document.getElementById("artists").value
    if (input !== "") {
        fetch(`/artist?name=${input}`).then(res => {
            res.json().then(res => {
                artistsDropdown.innerHTML = "" // preparing the dropdown to be filled
                let counter = 0
                const artistsNames = []
                for (const i of res.artists.items) artistsNames.push(i.name)
                const noDupArtists = Array.from(new Set(artistsNames)) // to remove duplicated names
                for (const i of noDupArtists) {
                    artistsDropdown.innerHTML += `<li><button class="btn dropdown-item" onclick="addArtist('${i}')">${i}</button></li>`
                    counter++
                }
                if (counter == 0) {
                    artistsDropdown.innerHTML = `<li><button class="btn dropdown-item">Nothing to show</button></li>`
                }
            })
        })
    } else artistsDropdown.innerHTML = `<li><button class="btn dropdown-item">Nothing to show</button></li>`
}

function addArtist(artist) {
    if (!chosenArtists.includes(artist)) { // only if not already added to the artists' array
        chosenArtistsList.innerHTML += `<div class="col-auto m-2" id="${artist}">
                                            <button class="btn btn-secondary" onclick="removeArtist('${artist}')">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x me-1" viewBox="0 0 16 16">
                                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                            </svg>
                                            ${artist}
                                            </button>
                                        </div>`
        chosenArtists.push(artist)
    }
}

function removeArtist(artist) {
    if (chosenArtists.includes(artist)) { // to avoid errors in removing the child
        chosenArtists.splice(chosenArtists.indexOf(artist), 1)
        document.getElementById("chosenArtistsList").removeChild(document.getElementById(artist))
    }
}