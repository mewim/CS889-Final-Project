<template>
  <div id="app">
    <div>
      <b-card no-body>
        <b-tabs card content-class="mt-3" v-model="tabIndex">
          <b-tab title="Spotify Viz" disabled></b-tab>
          <b-tab title="Similarity"><SimilarityView ref="1"/></b-tab>
          <b-tab title="Collaboration Network"
            ><CollaborationNetworkView ref="2"
          /></b-tab>
          <b-tab title="Timeline"><TimelineView ref="3"/></b-tab>
          <b-tab title="Search"><SearchView ref="4"/></b-tab>
        </b-tabs>
      </b-card>

      <b-modal ref="genresModal" hide-footer title="Genres" size="xl">
        <img src="/genre-cloud.png" style="width:100%" />
      </b-modal>
    </div>
  </div>
</template>

<script>
import SimilarityView from "./components/SimilarityView.vue";
import CollaborationNetworkView from "./components/CollaborationNetworkView.vue";
import TimelineView from "./components/TimelineView.vue";
import SearchView from "./components/SearchView.vue";
import EventBus from "./EventBus";
import Events from "./Events";

export default {
  name: "App",
  components: {
    SimilarityView,
    CollaborationNetworkView,
    TimelineView,
    SearchView,
  },
  data() {
    return {
      tabIndex: 1,
      artistId: undefined,
      similaritySongId: undefined,
      timelineSongId: undefined,
    };
  },
  methods: {
    setupEventHandlers: function() {
      EventBus.$on(Events.JUMP_TO_TIMELINE, this.jumpToTimeline);
      EventBus.$on(Events.JUMP_TO_COLLABORATION, this.jumpToCollaboration);
      EventBus.$on(Events.JUMP_TO_SIMILARITY, this.jumpToSimilarity);
      EventBus.$on(Events.SET_SIMILARITY_SONG, this.setSimilaritySong);
      EventBus.$on(Events.SET_ARTIST, this.setArtist);
      EventBus.$on(Events.SET_TIMELINE_SONG, this.setTimelineSong);
      EventBus.$on(Events.PAUSE_ALL_YOUTUBE, this.pauseAllYoutube);
      EventBus.$on(Events.OPEN_GENRES_MODAL, this.openGenresModal);
    },
    jumpToTimeline: function(songId) {
      this.timelineSongId = songId;
      this.tabIndex = 3;
    },
    jumpToCollaboration: function(artistId) {
      this.artistId = artistId;
      this.tabIndex = 2;
    },
    jumpToSimilarity: function(songId) {
      this.similaritySongId = songId;
      this.tabIndex = 1;
    },
    setSimilaritySong: function(item) {
      this.similaritySongId = item;
    },
    setTimelineSong: function(item) {
      this.timelineSongId = item;
    },
    setArtist: function(item) {
      this.artistId = item;
    },
    pauseAllYoutube: function() {
      document.querySelectorAll("iframe").forEach((p) => {
        try {
          p.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo" }),
            "*"
          );
        } catch (_) {
          return;
        }
      });
    },
    openGenresModal: function() {
      this.$refs.genresModal.show();
    },
  },
  mounted: function() {
    this.setupEventHandlers();
    const component = this.$refs[String(1)];
    component.tabLoaded();
  },
  watch: {
    tabIndex: function() {
      const component = this.$refs[String(this.tabIndex)];
      if (this.tabIndex == 2) {
        component.tabLoaded(this.artistId);
      } else if (this.tabIndex == 1) {
        component.tabLoaded(this.similaritySongId);
      } else {
        component.tabLoaded(this.timelineSongId);
        this.timelineSongId = null;
      }
    },
  },
};
</script>

<style lang="scss">
body {
  overflow: hidden;
}
$navbar-height: 54px;
$padding: 8px;

.nav-item:first-child > a {
  color: black !important;
  font-family: "Indie Flower", cursive;
  font-weight: bold;
}

.tab-content.mt-3 {
  margin-top: 0px !important;
  padding: $padding;
  min-height: calc(100vh - #{$navbar-height});
  width: 100%;
  > .tab-pane {
    height: calc(100vh - #{$navbar-height + $padding * 2});
    width: calc(100% - #{$padding * 2});
    position: absolute;
    > * {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
