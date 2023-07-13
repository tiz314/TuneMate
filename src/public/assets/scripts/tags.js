const chosenTags = []

function addTag(input) { // to add a new tag to the list
    if (document.getElementById("tags").value != "" || input != undefined) {
        input = document.getElementById("tags").value != "" ? document.getElementById("tags").value : input // to make the function usable in three different cases: 1. by reading the tags input in profile.html when creating a new playlist 2. when filling tag pills in the playlist edit modal in playlist.html  3. while searching public playlists
        // here a little sanitizing process to exclude some frontend edge cases
        if (input.replace(/\s/g, '').length) { // continue if the tag is not only whitespaces
            input = input.replace(/[&\/\\,#+()$~%.'":*?<>{}`]/g, '')
            if (input.length > 0) {
                const chosenTagsList = document.getElementById("chosenTagsList")
                if (!chosenTags.includes(input)) {
                    chosenTagsList.innerHTML += `<div class="col-auto m-2" id="${input}">
                                    <button class="btn btn-secondary" onclick="removeTag('${input}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x me-1" viewBox="0 0 16 16">
                                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                    </svg>
                                    ${input}
                                    </button>
                                </div>`
                    chosenTags.push(input)
                }
            }
        }
    }
}

function removeTag(tag) {
    if (chosenTags.includes(tag)) {
        chosenTags.splice(chosenTags.indexOf(tag), 1)
        document.getElementById("chosenTagsList").removeChild(document.getElementById(tag))
    }
}