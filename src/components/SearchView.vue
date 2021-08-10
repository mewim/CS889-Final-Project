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
          >Search</b-button
        >
      </div>
    </div>

    <div class="search-results-player-container">
      <div class="serach-results-container" v-show="isSearchResultsShown">
        <b-card v-for="track in results" :key="track._id">
          <h4 class="card-title">
            <a href="#" @click.prevent="jumpToSimilarity(track._id)">{{
              track.name
            }}</a>
          </h4>
          <h6 class="card-subtitle text-muted mb-2">
            {{ formatDuration(track.duration_ms) }}
          </h6>
          <b-card-text>
            <span v-for="(artist, key) in track.artists" :key="key">
              <a href="#" @click.prevent="jumpToCollaboration(artist._id)">{{
                artist.name
              }}</a
              ><span v-if="key + 1 !== track.artists.length">, </span>
            </span>
            (<a href="#" @click.prevent="jumpToTimeline(track._id)">{{
              String(track.release_year)
            }}</a
            >)
            <p>{{track.genre}}</p>
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
          allowfullscreen="allowfullscreen"
          mozallowfullscreen="mozallowfullscreen"
          msallowfullscreen="msallowfullscreen"
          oallowfullscreen="oallowfullscreen"
          webkitallowfullscreen="webkitallowfullscreen"
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
import EventBus from "../EventBus";
import Events from "../Events";

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
    tabLoaded: async function() {},
    formatDuration(ms) {
      return moment.utc(ms).format("mm:ss");
    },
    searchButtonClicked: async function() {
      if (this.searchBarText.length === 0) {
        this.results = [];
        return;
      }
      this.results = await this.loadSeachResult(this.searchBarText);
    },
    loadSeachResult: async function(keyword) {
      const params = new URLSearchParams([["name", keyword]]);
      const results = await axios
        .get(`/api/track`, { params })
        .then((res) => res.data);
      return results;
    },
    playTrack: async function(trackId) {
      EventBus.$emit(Events.PAUSE_ALL_YOUTUBE);
      const res = await axios.get(`/api/track/${trackId}/youtube-url`);
      const url = res.data.url;
      this.currentSongUrl = url;
    },
    jumpToTimeline: function(trackId) {
      EventBus.$emit(Events.JUMP_TO_TIMELINE, trackId);
    },
    jumpToCollaboration: function(artistId) {
      EventBus.$emit(Events.JUMP_TO_COLLABORATION, artistId);
    },
    jumpToSimilarity: function(trackId) {
      EventBus.$emit(Events.JUMP_TO_SIMILARITY, trackId);
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
