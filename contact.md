---
title: Contact
permalink: "/contact/"
calendly_username: none
---

{%- if site.upwork_profile -%}
<a class="button" href="{{ site.upwork_profile }}" target="_blank">Contact me on UpWork</a>,  {% if site.nocal %} or {% if site.formspree %}
 send a message with the form below
{% endif %}
{% endif %}
{%- endif -%}

{%- unless site.formspree -%}
<a class="button" href="mailto:me@jacobmacmillan.xyz">Send an email</a> 
{%- unless site.nocal -%}
or schedule a meeting below.
{%- endunless -%}

{%- else -%}
<div class="formspree">
<form class="formspree" action="{{ site.formspree }}" method="POST">
  <label>
    <input type="email" name="email" placeholder="Your email address">
  </label>
  <label>
    <textarea name="message" placeholder="Your message"></textarea>
  </label>
  <!-- your other form fields go here -->
  <button type="submit">Send</button>
</form>
</div>
{%- endunless -%}

{%- unless site.nocal -%}
<noscript><a href="https://cal.com/jacobmacmillan">Schedule a meeting through Cal (requires Javascript)</a></noscript>

<!-- Cal inline embed code begins -->
<div style="width:100%;height:100%;overflow:scroll" id="my-cal-inline"></div>
<script type="text/javascript">
  (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; typeof namespace === "string" ? (cal.ns[namespace] = api) && p(api, ar) : p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
Cal("init", "30min", {origin:"https://cal.com"});

  Cal.ns["30min"]("inline", {
	elementOrSelector:"#my-cal-inline",
	calLink: "jacobmacmillan/30min",
	layout: "month_view"
  });
  
  Cal.ns["30min"]("ui", {"styles":{"branding":{"brandColor":"#000000"}},"hideEventTypeDetails":false,"layout":"month_view"});
  </script>
  <!-- Cal inline embed code ends -->
{%- endunless -%}
