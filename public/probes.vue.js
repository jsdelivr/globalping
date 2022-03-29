const probes = () => ({
  data() {
    return {
      probes: [],
    }
  },
  created() {
    this.fetchProbes()
  },
  methods: {
    async fetchProbes() {
      const url = '/v1/probes';
      this.probes = await (await fetch(url)).json()
    },
  },
  template: `
      <div>
        <h2>
          {{ probes.length }} probes available
        </h2>
        <ul>
          <li v-for="probe in probes">
            {{ probe.city }}, {{ probe.country }}
          </li>
        </ul>
      </div>
    `
});

Vue.createApp(probes()).mount('#probes');
