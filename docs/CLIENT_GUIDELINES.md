# Globalping API Client Guidelines

 - Set the `inProgressUpdates` option to `true` if the application is running in interactive mode so that the user sees the results right away.
   - If the application is interactive by default but also implements a "CI" mode to be used in scripts, do not set the flag in the CI mode.
 - Use the following algorithm for measurement result pooling:
   1. Request the measurement status.
   2. If the status is `in-progress`, wait 500 ms and repeat from step 1. Note that it is important to wait 500 ms *after* receiving the response, instead of simply using an "every 500 ms" interval. For large measurements, the request itself may take a few hundred milliseconds to complete.
   3. If the status is anything else, stop. The measurement is no longer running. Note that there are several possible status values, such as `finished`, `failed`, and `timed-out`. Any value other than `in-progress` is final.

Additional guidelines for non-browser based apps:
 - Set a `User-Agent` header. The recommended format and approach is [as here](https://github.com/jsdelivr/data.jsdelivr.com/blob/60c5154d26c403ba9dd403a8ddc5e42a31931f0d/config/default.js#L9).
 - Set an `Accept-Encoding` header with a value of either `br` (preferred) or `gzip`, depending on what your client can support. The compression has a significant impact on the response size.
 - When requesting the measurement status, implement ETag-based client-side caching using the `ETag`/`If-None-Match` headers.
