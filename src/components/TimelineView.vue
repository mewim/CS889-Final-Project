<template>
  <div>
    <h1>Timeline View</h1>
  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "TimelineView",
  data() {
    return {};
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function () {
      // test functions
      console.log(await this.getAggregationResult(2010, 2020));
      console.log(await this.getTopSongs(null, null, 10));
      console.log(await this.getTopSongs(2010, null, 10));
      console.log(await this.getTopSongs(2010, 2011, 10));
    },
    getAggregationResult: function (startYear, endYear) {
      return axios
        .get(`/api/track/aggregation/${startYear}/${endYear}`)
        .then((res) => res.data);
    },
    getTopSongs: function (startYear, endYear, limit) {
      const paramsArray = [];
      if (startYear) {
        paramsArray.push(["start_year", startYear]);
      }
      if (endYear) {
        paramsArray.push(["end_year", endYear]);
      }
      if (limit) {
        paramsArray.push(["limit", limit]);
      }
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/track/top-songs`, { params })
        .then((res) => res.data);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
</style>
