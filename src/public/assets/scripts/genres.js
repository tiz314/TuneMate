let availableGenres = []
fetch("/genre").then(res => {
    res.json().then(res => {
        availableGenres = res.genres
    })
})
const chosenGenres = [] // storing every available genre once at page load
const genresDropdown = document.getElementById("genresDropdown")
const chosenGenresList = document.getElementById("chosenGenresList")


function fillGenreList() {
    const input = document.getElementById("genres").value.toLowerCase() // putting the input to lowercase to avoid case sensitive "nothing found" results

    if (input !== "") {
        genresDropdown.innerHTML = "" // preparing the dropdown to be filled
        let counter = 0

        for (const i of availableGenres) {

            if (i.includes(input)) {
                genresDropdown.innerHTML += `<li><button class="btn dropdown-item" onclick="addGenre('${i}')">${i}</button></li>`
                counter++
            }
        }
        if (counter == 0) {
            genresDropdown.innerHTML = `<li><button class="btn dropdown-item">Nothing to show</button></li>`
        }
    } else genresDropdown.innerHTML = `<li><button class="btn dropdown-item">Nothing to show</button></li>`
}

function addGenre(genre) {
    if (!chosenGenres.includes(genre)) {
        chosenGenresList.innerHTML += `<div class="col-auto m-2" id="${genre}">
                                            <button class="btn btn-secondary" onclick="removeGenre('${genre}')">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x me-1" viewBox="0 0 16 16">
                                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                            </svg>
                                            ${genre}
                                            </button>
                                        </div>`
        chosenGenres.push(genre)
    }
}

function removeGenre(genre) {
    if (chosenGenres.includes(genre)) {
        chosenGenres.splice(chosenGenres.indexOf(genre), 1)
        document.getElementById("chosenGenresList").removeChild(document.getElementById(genre))
    }
}