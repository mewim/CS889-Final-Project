// Run in Chrome Console on https://www.musicgenreslist.com/
function extractGenres() {
  const div = document.querySelector("#post-71 > div > div:nth-child(8)");
  const uls = div.querySelectorAll("div > ul");
  const genres = [];
  for (let ul of uls) {
    const lisTop = ul.querySelectorAll("ul:scope>li");
    for (let liTop of lisTop) {
      let genre = liTop.firstChild.innerText;
      if (!genre) {
        genre = liTop.innerText.split("\n")[0];
      }
      const sub_genres = liTop.innerText.split("\n").filter((t) => Boolean(t));
      genres.push({ name: genre, sub_genres });
    }
  }
  return genres;
}

let results = JSON.stringify(extractGenres(), null, 2);
console.log(results);
copy(results);
