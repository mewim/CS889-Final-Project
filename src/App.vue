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
    return { tabIndex: 1, artistId: undefined, songId: undefined };
  },
  methods: {
    setupEventHandlers: function() {
      EventBus.$on(Events.JUMP_TO_TIMELINE, this.jumpToTimeline);
      EventBus.$on(Events.JUMP_TO_COLLABORATION, this.jumpToCollaboration);
      EventBus.$on(Events.JUMP_TO_SIMILARITY, this.jumpToSimilarity);
      EventBus.$on(Events.SET_SONG, this.setSong);
      EventBus.$on(Events.SET_ARTIST, this.setArtist);
      EventBus.$on(Events.PAUSE_ALL_YOUTUBE, this.pauseAllYoutube);
    },
    jumpToTimeline: function(songId) {
      this.songId = songId;
      this.tabIndex = 3;
    },
    jumpToCollaboration: function(artistId) {
      this.artistId = artistId;
      this.tabIndex = 2;
    },
    jumpToSimilarity: function(songId) {
      this.songId = songId;
      this.tabIndex = 1;
    },
    setSong: function(item) {
      this.songId = item;
    },
    setArtist: function(item) {
      this.artistId = item;
    },
    pauseAllYoutube: function() {
      document.querySelectorAll("iframe").forEach((p) => {
        try {
          p.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo" }),
            "https://www.youtube.com"
          );
        } catch (_) {
          return;
        }
      });
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
      } else {
        component.tabLoaded(this.songId);
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
  font-family: 'Indie Flower', cursive;
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
