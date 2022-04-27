const app = () => ({
  data() {
    return {
      query: {
        type: 'ping',
        locations: [],
        target: 'google.com',
        limit: 1,
        query: {}
      },
      response: {
        data: null,
        error: null
      },
      selectedResultIndex: null,
      measurementId: null,
    };
  },
  watch: {
    measurementId(nId, oId) {
      // prevent loop on empty value
      if (nId) {
        this.resultInterval = setInterval(this.fetchMeasurement.bind(this), 500);
      }
    },
    'response.data.results'() {
      if (!this.selectedResultIndex || this.selectedResultIndex > 0) {
        this.selectedResultIndex = 0;
      }
    },
    'response.data.status'(status) {
      if (status === 'finished') {
        clearInterval(this.resultInterval);
      }
    }
  },
  computed: {
    responseParams() {
      if (!this.response.error || !this.response.error.error.params) {
        return '';
      }

      const errList = Object.entries(this.response.error.error.params).map(([key, value]) => `[${key}] ${value}`);
      return errList.join('<br>').trim();
    },
    responseRawOutput() {
      const index = this.selectedResultIndex;
      const output = this.response.data.results[index].result.rawOutput;

      if (!output) {
        return null;
      }

      return output.trim();
    },
    responseJSON() {
      return JSON.stringify(this.response.data, 0, 2).trim();
    }
  },
  methods: {
    getDnsTypeArray() {
      return ALLOWED_DNS_TYPES;
    },
    getDnsProtocolArray() {
      return ALLOWED_DNS_PROTOCOLS;
    },
    getTraceProtocolArray() {
      return ALLOWED_TRACE_PROTOCOLS;
    },
    getQueryTypeArray() {
      return ALLOWED_QUERY_TYPES;
    },
    getLocationTypeArray() {
      return ALLOWED_LOCATION_TYPES;
    },
    submitPostMeasurement(e) {
      e.preventDefault();
      this.response = {};
      this.buildAndPostMeasurement();
    },
    buildAndPostMeasurement() {
      const measurement = {
        type: this.query.type,
        target: this.query.target
      };

      if (this.query.type === 'ping' && this.query.packets) {
        measurement.packets = this.query.packets;
      }

      if (this.query.type === 'traceroute') {
        if (this.query.protocol) {
          measurement.protocol = this.query.protocol;
        }

        if (this.query.port) {
          measurement.port = this.query.port;
        }
      }

      if (this.query.type === 'dns') {
        const query = {};

        if (this.query.query.protocol) {
          query.protocol = this.query.query.protocol;
        }

        if (this.query.query.type) {
          query.type = this.query.query.type;
        }

        if (this.query.query.port) {
          query.port = this.query.query.port;
        }

        if (this.query.query.resolver) {
          query.resolver = this.query.query.resolver;
        }

        if (this.query.query.trace) {
          query.trace = !!this.query.query.trace;
        }

        if (Object.keys(query).length > 0) {
          measurement.query = query;
        }
      }

      const locations = this.query.locations.map(({ id, limit, ...l}) => ({
        ...l,
        ...(limit ? { limit } : {})
      }))

      this.postMeasurement(this.query.limit, measurement, locations);
    },
    addNewLocation(e) {
      e.preventDefault();

      const loc = { id: Date.now(), type: '', value: '', limit: 1 };
      this.query.locations.push(loc);
    },
    removeLocation(e) {
      e.preventDefault();

      const index = +e.target.value;

      this.query.locations = [
        ...this.query.locations.slice(0, index),
        ...this.query.locations.slice(index + 1)
      ];
    },
    async postMeasurement(limit = 1, measurement = {}, locations = []) {
      const url = '/v1/measurements';

      const body = {
        measurement,
        locations
      };

      if (!locations.find(l => l.limit)) {
        body.limit = limit;
      }

      const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.measurementId = data.id;
      } else {
        const error = await response.json();

        this.response = {
          error
        };
      }
    },
    async fetchMeasurement() {
      const url = `/v1/measurements/${this.measurementId}`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        this.response = {
          data
        };
      } else {
        const error = await response.json();

        this.response = {
          error
        };
      }
    }
  },
  template: `
    <div class="row">
      <h2>
        query
      </h2>
    </div>
    <div class="row border border-primary">
      <form @submit="submitPostMeasurement" class="col">
        <div class="form-group row">
          <label for="query_type" class="col-sm-2 col-form-label">type</label>
          <div class="col-sm-10">
            <select v-model="query.type" name="query_type" id="query_type" class="custom-select my-1 mr-sm-2">
              <option disabled value="">Please select one</option>
              <option v-for="type in getQueryTypeArray()" :value="type">
                {{ type }}
              </option>
            </select>
          </div>
        </div>
        <div class="form-group row">
          <label for="query_target" class="col-sm-2 col-form-label">target</label>
          <div class="col-sm-10">
            <input v-model="query.target" name="query_target" id="query_target" placeholder="target" />
          </div>
        </div>
        <div class="form-group row">
          <label for="query_global_limit" class="col-sm-2 col-form-label">limit</label>
          <div class="col-sm-10">
            <input type="number" v-model="query.limit" id="query_global_limit" name="query_global_limit" placeholder="global limit" />
          </div>
        </div>
        <div v-if="query.type === 'ping'" class="form-group row">
          <label for="query_packets" class="col-sm-2 col-form-label">packets</label>
          <div class="col-sm-10">
            <input type="number" v-model="query.packets" id="query_packets" name="query_packets" placeholder="packets" />
          </div>
        </div>
        <div v-if="query.type === 'traceroute'" class="form-group row">
          <label for="query_port" class="col-sm-2 col-form-label">port</label>
          <div class="col-sm-10">
            <input type="number" v-model="query.port" id="query_port" name="query_port" placeholder="port" />
          </div>
        </div>
        <div v-if="query.type === 'traceroute'" class="form-group row">
          <label for="query_protocol" class="col-sm-2 col-form-label">protocol</label>
          <div class="col-sm-10">
            <select v-model="query.protocol" name="query_protocol" id="query_protocol" class="custom-select my-1 mr-sm-2">
              <option disabled value="">Please select one</option>
              <option v-for="protocol in getTraceProtocolArray()" :value="protocol">
                {{ protocol }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="query.type === 'dns'" class="form-group row">
          <label for="query_dns_type" class="col-sm-2 col-form-label">trace</label>
          <div class="col-sm-10">
            <input type="checkbox" v-model="query.query.trace" >
          </div>
        </div>
        <div v-if="query.type === 'dns'" class="form-group row">
          <label for="query_dns_type" class="col-sm-2 col-form-label">dns type</label>
          <div class="col-sm-10">
            <select v-model="query.query.type" name="query_dns_type" id="query_dns_type" class="custom-select my-1 mr-sm-2">
              <option disabled value="">Please select one</option>
              <option v-for="type in getDnsTypeArray()" :value="type">
                {{ type }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="query.type === 'dns'" class="form-group row">
          <label for="query_protocol" class="col-sm-2 col-form-label">protocol</label>
          <div class="col-sm-10">
            <select v-model="query.query.protocol" name="query_protocol" id="query_protocol" class="custom-select my-1 mr-sm-2">
              <option disabled value="">Please select one</option>
              <option v-for="protocol in getDnsProtocolArray()" :value="protocol">
                {{ protocol }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="query.type === 'dns'" class="form-group row">
          <label for="query_dns_port" class="col-sm-2 col-form-label">port</label>
          <div class="col-sm-10">
            <input type="number" v-model="query.query.port" id="query_dns_port" name="query_dns_port" placeholder="port" />
          </div>
        </div>
        <div v-if="query.type === 'dns'" class="form-group row">
          <label for="query_dns_resolver" class="col-sm-2 col-form-label">resolver</label>
          <div class="col-sm-10">
            <input type="text" v-model="query.query.resolver" id="query_dns_resolver" name="query_dns_resolver" placeholder="resolver" />
          </div>
        </div>

        <div>
          <h3>
            location filters
          </h3>
          <ul>
            <li v-for="(m, index) in query.locations" :key="m.id">
              <select v-model="query.locations[index].type">
                <option disabled value="">Please select one</option>
                <option v-for="type in getLocationTypeArray()" :value="type">
                  {{ type }}
                </option>
              </select>
              <input v-model="query.locations[index].value" placeholder="value" />
              <input type="number" v-model="query.locations[index].limit" placeholder="global limit" />
              <button @click="removeLocation" :value="index">remove</button>
            </li>
          </ul>
        </div>
        <div>
          <button @click="addNewLocation">add location</button>
          <button type="submit">measure</button>
        </div>
      </form>
    </div>
    <div class="row" v-if="response.error">
      <div style="color: red;" class="col">
        <div class="row">
          {{ response.error.error.message }}
        </div>
        <div class="row">
          {{ responseParams }}
        </div>
      </div>
    </div>
    <div>
      {{ query.type }} {{ query.target }} {{ query.limit }}
    </div>
    <div v-if="response.data" class="row border">
      <select v-model="selectedResultIndex">
        <option v-for="(result, index) in response.data.results" :value="index">result {{ index }}</option>
      </select>
      <pre v-if="response.data" class="bg-light"><code>{{ responseRawOutput }}</code></pre>
      <pre v-if="response.data" class="bg-light"><code>{{ responseJSON }}</code></pre>
    </div>
  `
});

Vue.createApp(app()).mount('#app');
