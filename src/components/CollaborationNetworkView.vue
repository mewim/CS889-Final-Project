<template>
  <div>
    <svg id="collaboration-network-demo"></svg>
  </div>
</template>

<script>
import * as d3 from "d3";
import axios from "axios";

export default {
  name: "CollaborationNetworkView",
  data() {
    return {
      graphData: {
        nodes: undefined,
        edges: undefined,
      },
      rendered: false,
    };
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function () {
      if (this.rendered) {
        return;
      }
      await this.loadData();
      this.drawNodeLinkDiagram();
      this.rendered = true;
    },

    loadData: async function () {
      // Hard-coded artist for now: Eminem
      const apiResult = await this.getCollaborationNetworkByArtist(
        "60fb73f6a8b65b7b2d9153df",
        2
      );
      const edges = apiResult.relationships;
      const nodes = apiResult.artists;
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].id = nodes[i]._id;
      }
      for (let i = 0; i < edges.length; ++i) {
        edges[i].source = edges[i].artist_1;
        edges[i].target = edges[i].artist_2;
      }
      this.graphData.nodes = nodes;
      this.graphData.edges = edges;
    },

    getCollaborationNetworkByArtist: function (pivotId, depth) {
      const paramsArray = [];
      if (!pivotId) {
        throw new Error(
          "Pivot artist ID must be specified for `getCollaborationNetworkByArtist`"
        );
      }
      paramsArray.push(["pivot", pivotId]);

      if (depth) {
        paramsArray.push(["depth", depth]);
      }
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/aritstcollaboration`, { params })
        .then((res) => res.data);
    },

    drawNodeLinkDiagram: function () {
      const nodes = this.graphData.nodes;
      const edges = this.graphData.edges;
      const svg = d3.select("#collaboration-network-demo");
      const bbox = document
        .getElementById("collaboration-network-demo")
        .getBoundingClientRect();

      const width = bbox.width,
        height = bbox.height;

      const simulation = d3
        .forceSimulation(nodes)
        .force(
          "link",
          d3.forceLink(edges).id((d) => d.id)
        )
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2));

      const drag = (simulation) => {
        function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }

        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }

        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }

        return d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended);
      };

      const link = svg
        .append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(edges)
        .join("line")
        .attr("stroke-width", (d) => Math.sqrt(d.value));

      const node = svg
        .append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 5)
        .attr("fill", "#66ccff")
        .call(drag(simulation));

      node.append("title").text((d) => `${d.name}\n${d.genres.join(", ")}`);
      link.append("title").text((d) => `${d.count} collaborations`);

      window.node = node;
      window.link = link;
      simulation.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
#collaboration-network-demo {
  min-width: 100%;
  min-height: 100%;
}
</style>
