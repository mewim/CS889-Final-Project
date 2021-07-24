<template>
  <div>
    <svg id="collaboration-network-demo"></svg>
  </div>
</template>

<script>
import * as d3 from "d3";

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
      const edges = await d3.csv("/jean-complete-edge.csv");
      const nodes = await d3.csv("/jean-complete-node.csv");
      const nodeIdHash = {};
      for (let i = 0; i < nodes.length; ++i) {
        const currNode = nodes[i];
        nodeIdHash[currNode.Id] = i;
        nodes[i].id = i;
      }
      for (let i = 0; i < edges.length; ++i) {
        const source = nodeIdHash[edges[i].Source];
        const target = nodeIdHash[edges[i].Target];

        delete edges[i].Source;
        delete edges[i].Target;
        edges[i].source = source;
        edges[i].target = target;
      }
      this.graphData.nodes = nodes;
      this.graphData.edges = edges;
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

      node.append("title").text((d) => `${d.Id}\n${d.Label}\n${d.Description}`);
      link.append("title").text((d) => `${d.Id}`);

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
