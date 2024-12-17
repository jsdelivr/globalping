// types
const ALLOWED_QUERY_TYPES = [ 'ping', 'traceroute', 'dns', 'mtr', 'http' ];

// filters
const ALLOWED_LOCATION_TYPES = [ 'continent', 'region', 'country', 'state', 'city', 'asn', 'network', 'tags', 'magic' ];

// ip versions
const ALLOWED_IP_VERSIONS = [ 4, 6 ];

// traceroute
const ALLOWED_TRACE_PROTOCOLS = [ 'TCP', 'UDP', 'ICMP' ];

// dns
const ALLOWED_DNS_TYPES = [ 'A', 'AAAA', 'ANY', 'CNAME', 'DNSKEY', 'DS', 'HTTPS', 'MX', 'NS', 'NSEC', 'PTR', 'RRSIG', 'SOA', 'TXT', 'SRV' ];
const ALLOWED_DNS_PROTOCOLS = [ 'UDP', 'TCP' ];

// mtr
const ALLOWED_MTR_PROTOCOLS = [ 'TCP', 'UDP', 'ICMP' ];

// http
const ALLOWED_HTTP_PROTOCOLS = [ 'HTTP', 'HTTPS', 'HTTP2' ];
const ALLOWED_HTTP_METHODS = [ 'GET', 'HEAD', 'OPTIONS' ];
