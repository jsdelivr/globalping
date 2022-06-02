// filters
const ALLOWED_LOCATION_TYPES = ['continent', 'region', 'country', 'state', 'city', 'asn', 'network', 'magic'];
const ALLOWED_QUERY_TYPES = ['ping', 'traceroute', 'dns', 'mtr'];
// traceroute
const ALLOWED_TRACE_PROTOCOLS = ['TCP', 'UDP', 'ICMP'];
// dns
const ALLOWED_DNS_TYPES = ['A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV'];
const ALLOWED_DNS_PROTOCOLS = ['UDP', 'TCP'];
// mtr
const ALLOWED_MTR_PROTOCOLS = ['TCP', 'UDP', 'ICMP'];
