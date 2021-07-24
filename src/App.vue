
<template>
  <div id="app">
    <div>
      <b-tabs content-class="mt-3">
        <b-tab title="Spotify Viz" disabled></b-tab>
        <b-tab title="First" active><HelloWorld msg="Test" /></b-tab>
        <b-tab title="Second"><p>I'm the second tab</p></b-tab>
      </b-tabs>
    </div>
  </div>
</template>


<script>
import HelloWorld from "./components/HelloWorld.vue";

export default {
  name: "App",
  components: {
    HelloWorld,
  },
};
</script>

<style lang="scss">
$navbar-height: 42px;
$padding: 8px;

.nav-item:first-child > a {
  color: black !important;
  font-family: fantasy;
  font-weight: bold;
}

.tab-content.mt-3 {
  margin-top: 0px !important;
  padding: $padding;
  min-height: calc(100vh - #{$navbar-height});
  width: 100%;
  > .tab-pane.active {
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
