<template>
  <div id="collaboration-network-view">
    <div id="artist-songs-card" 
      style="position:absolute;width:fit-content;height:fit-content;display: none; z-index: 4;">
      <b-card style="width: 30em;background-color:#f8f8f8;max-height:40vh;overflow-y:auto;" class="mb-2">
        <b-card-title id="artist-songs-title" style="text-transform: capitalize;">
          Songs of this Artist
        </b-card-title>
        <b-card-text id="artist-songs-body" style="text-transform: capitalize;">
          <ul>
            <li v-for="item in songs" v-bind:key="item.song">
              {{ item.song }}
            </li>
          </ul>
        </b-card-text>
      </b-card>
    </div>
    <div id="artist-card" 
      style="position:absolute;bottom:0px;padding-bottom:1.25rem;width:fit-content;height:fit-content;display: none; z-index: 5;">
      <b-card style="width: 30rem;background-color:#f8f8f8;max-height: 55vh; overflow-y:auto;" class="mb-2">
        <b-card-title id="artist-title" style="text-transform: capitalize;">
          Card Title
        </b-card-title>
        <b-card-text id="artist-body">
          <b>Genres of this artist:</b>
          <ul>
            <li v-for="item in genres" v-bind:key="item.genre">
              <a style="cursor:pointer;" :class="item" v-on:click="highlightGenres(item)">{{ item.genre }}</a>
            </li>
          </ul>
          <b>Other genres in this graph:</b>
          <ul>
            <li v-for="item in genres2" v-bind:key="item.genre">
              <a style="cursor:pointer;" :class="item" v-on:click="highlightGenres(item)">{{ item.genre }}</a>
            </li>
          </ul>
          <b-button v-on:click="highlightGenres(null)">Reset</b-button>
          <br><br>
        </b-card-text>
      </b-card>
    </div>
    <div id="spinner2" style="position: absolute; width:fit-content;height:fit-content;z-index:6; display:none;">
      <b-card style="width: 15em;" class="mb-2">
        <img src="/loading2.gif" style="width:12.5em;"/>
      </b-card>
    </div>
    <svg id="collaboration-network-demo" style="position:absolute;"></svg>
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
      maxCount: -1,
      genres: [],
      genres2: [],
      songs: [],
      currId: null,
    };
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function (newArtistId="60fb73f6a8b65b7b2d9153df") {
      if (this.rendered && this.currId === newArtistId) {
        return;
      }
      await this.reload(newArtistId);
      this.rendered = true;
    },

    reload: async function(id) {
      d3.select("#collaboration-network-demo").html("");
      d3.select("#artist-songs-card").style("display", "none");
      d3.select("#artist-card").style("display", "none");
      d3.select("#spinner2").style("display", "inline");
      this.currId = id;
      await this.loadData(id);
      d3.select("#spinner2").style("display", "none");
      d3.select("#artist-card").style("display", "inline");
      d3.select("#artist-songs-card").style("display", "inline");
      this.drawNodeLinkDiagram(id);
    },

    highlightGenres: async function(item) {
      var vueinstance = this;
      const scale = d3.scaleLinear().range(["#66ccff", "#3366ff"]).domain([0, Math.sqrt(vueinstance.maxCount)]);
      const svg = d3.select("#collaboration-network-demo");
      svg
        .selectAll("circle")
        .data(this.graphData.nodes)
        .join("circle")
        .attr("fill", function (d) {
          if (d.id==vueinstance.currId) {return "#2d2d2d";}
          if (item != null && d.genres.includes(item.genre)) {return "#00cc00";}
          return scale(Math.sqrt(d.count));
        });
    },

    loadData: async function (id) {
      // Hard-coded artist for now: Eminem
      const apiResult = await this.getCollaborationNetworkByArtist(id, 2);
      const edges = apiResult.relationships;
      const nodes = apiResult.artists;
      this.genres2 = [];
      var othergenres = {};
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].id = nodes[i]._id;
        if (nodes[i].id == id) {
          // eslint-disable-next-line no-unused-labels
          this.genres = nodes[i].genres.map((k) => {return {genre: k};});
          d3.select("#artist-title").text(nodes[i].name);
        } else {
          for (let j = 0; j < nodes[i].genres.length; ++j) {
            if (!(nodes[i].genres[j] in othergenres)) {
              othergenres[nodes[i].genres[j]] = 0;
            }
            othergenres[nodes[i].genres[j]]++;
          }
        }
      }
      var othergenreslist = Object.keys(othergenres).map(function(key) {
        return [key, othergenres[key]];
      });
      othergenreslist.sort(function(first, second) {
        return second[1] - first[1];
      });
      var artistgenres = this.genres.map((k) => k.genre);
      for (let j = 0; j < othergenreslist.length; ++j) {
        if (!artistgenres.includes(othergenreslist[j][0])) {
          this.genres2.push({genre: othergenreslist[j][0]});
        }
      }
      this.genres2 = this.genres2.slice(0, 12-this.genres.length);
      var connections = {};
      for (let i = 0; i < edges.length; ++i) {
        edges[i].source = edges[i].artist_1;
        edges[i].target = edges[i].artist_2;
        if (edges[i].artist_1 == id) {
          connections.[edges[i].artist_2] = edges[i].count;
        }
        if (edges[i].artist_2 == id) {
          connections.[edges[i].artist_1] = edges[i].count;
        }
      }
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].count = connections[nodes[i].id];
        if (nodes[i].count == undefined) nodes[i].count = 0;
        this.maxCount = Math.max(this.maxCount, nodes[i].count);
      }
      this.graphData.nodes = nodes;
      this.graphData.edges = edges;
      // retreive songs
      const result = await axios
        .get(`/api/track/artist/${id}`, {})
        .then((res) => res.data);
      this.songs = result.map((k) => {return {song: k.name};});
      this.songs = this.songs.slice(0, 5);
    },

    getCollaborationNetworkByArtist: function (pivotId, depth, fetchAllEdges) {
      const paramsArray = [];
      if (!pivotId) {
        throw new Error(
          "Pivot artist ID must be specified for `getCollaborationNetworkByArtist`"
        );
      }
      paramsArray.push(["pivot", pivotId]);

      if (fetchAllEdges) {
        paramsArray.push(["fetch_all_edges", "true"]);
      }
      if (depth) {
        paramsArray.push(["depth", depth]);
      }
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/aritstcollaboration`, { params })
        .then((res) => res.data);
    },

    drawNodeLinkDiagram: function (id) {
      const vueinstance = this;
      const scale = d3.scaleLinear().range(["#66ccff", "#3366ff"]).domain([0, Math.sqrt(vueinstance.maxCount)]);
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
          if (event.subject) {
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          }
        }

        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }

        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          if (event.subject) {
            event.subject.fx = null;
            event.subject.fy = null;
          }
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
        .attr("stroke-width", (d) => Math.sqrt(d.count));

      const node = svg
        .append("g")
        .attr("stroke", "#fff")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 7)
        .attr("fill", function (d) {return d.id==id ? "#2d2d2d" : scale(Math.sqrt(d.count));})
        .attr("stroke-width", function (d) {return d.id==id ? 3.0 : 1.5})
        .call(drag(simulation))
        .on("click", function (d) {
          if (d.id != id) {
            vueinstance.reload(d.id);
          }
        });

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
  padding-left: 20%;
}
</style>
