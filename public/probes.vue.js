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
    parsedLocation(index) {
      const probe = this.probes[index];
      const city = probe.location.country === 'US' ? `${probe.location.city} (${probe.location.state})` : probe.location.city;

      return `${city}, ${probe.location.country}, ${probe.location.continent}, ${probe.location.asn}`
    },
    async fetchProbes() {
      const url = '/v1/probes';
      this.probes = await (await fetch(url)).json();
    },
  },
  template: `
      <div>
        <h2>
          {{ probes.length }} probes available
        </h2>
        <ul>
          <li v-for="(probe, index) in probes">
            [{{ probe.version }}] {{ parsedLocation(index) }}
          </li>
        </ul>
      </div>
    `
});

Vue.createApp(probes()).mount('#probes');
