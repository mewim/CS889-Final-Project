<template>
  <div class="outer-container">
    <div class="input-group mb-3">
      <b-form-input
        v-model="searchBarText"
        v-on:keyup.enter="searchButtonClicked()"
        placeholder="Enter name of the track"
      ></b-form-input>
      <div class="input-group-append">
        <b-button
          variant="success"
          class="search-button"
          v-on:click="searchButtonClicked()"
          >Seach</b-button
        >
      </div>
    </div>

    <div class="search-results-player-container">
      <div class="serach-results-container" v-show="isSearchResultsShown">
        <b-card
          v-for="track in results"
          :key="track._id"
          :title="track.name"
          :sub-title="formatDuration(track.duration_ms)"
        >
          <b-card-text>
            {{ track.original_artists.join(", ") }} ({{
              String(track.release_year)
            }})
          </b-card-text>
          <a href="#" @click.prevent="playTrack(track._id)" class="card-link"
            >Play on YouTube</a
          >
        </b-card>
      </div>
      <div class="player-container" v-show="isPlaying">
        <iframe
          type="text/html"
          width="480"
          height="270"
          :src="currentSongUrl"
          frameborder="0"
          allow="autoplay"
        ></iframe>
        <div class="text-center">
          <b-button variant="danger" v-on:click="currentSongUrl = ''"
            >Close</b-button
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import moment from "moment";

export default {
  name: "SearchView",
  data() {
    return {
      searchBarText: "",
      currentSongUrl: "",
      results: [],
    };
  },
  methods: {
    tabLoaded: async function () {},
    formatDuration(ms) {
      return moment.utc(ms).format("mm:ss");
    },
    searchButtonClicked: async function () {
      if (this.searchBarText.length === 0) {
        return;
      }
      this.results = await this.loadSeachResult(this.searchBarText);
    },
    loadSeachResult: async function (keyword) {
      const params = new URLSearchParams([["name", keyword]]);
      const results = await axios
        .get(`/api/track`, { params })
        .then((res) => res.data);
      return results;
    },
    playTrack: async function (trackId) {
      const res = await axios.get(`/api/track/${trackId}/youtube-url`);
      const url = res.data.url;
      this.currentSongUrl = url;
    },
  },

  computed: {
    isSearchResultsShown() {
      return this.results.length > 0;
    },
    isPlaying() {
      return Boolean(this.currentSongUrl);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
.outer-container {
  display: flex;
  flex-direction: column;
}
.search-results-player-container {
  display: flex;
  flex-direction: row;
  height: calc(100% - 48px);
  .serach-results-container {
    flex-grow: 1;
    padding-right: 4px;
    height: 100%;
    overflow-y: scroll;
  }
  .player-container {
    min-width: 480px;
    min-height: 270px;
  }
}
</style>
