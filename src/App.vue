
<template>
  <div id="app">
    <div>
      <b-card no-body>
      <b-tabs card content-class="mt-3" v-model="tabIndex">
        <b-tab title="Spotify Viz" disabled></b-tab>
        <b-tab title="Similarity"><SimilarityView ref="1" /></b-tab>
        <b-tab title="Collaboration Network"
          ><CollaborationNetworkView ref="2"
        /></b-tab>
        <b-tab title="Timeline"><TimelineView ref="3" /></b-tab>
        <b-tab title="Search"><SearchView ref="4" /></b-tab>
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

export default {
  name: "App",
  components: {
    SimilarityView,
    CollaborationNetworkView,
    TimelineView,
    SearchView,
  },
  data() {
    return { tabIndex: 1 };
  },
  mounted: function() {
    const component = this.$refs[String(1)];
    component.tabLoaded();
  },
  watch: {
    tabIndex: function () {
      const component = this.$refs[String(this.tabIndex)];
      component.tabLoaded();
    },
  },
};
</script>

<style lang="scss">
$navbar-height: 42px;
$padding: 8px;

.nav-item:first-child > a {
  color: black !important;
  font-family: "Style Script";
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
