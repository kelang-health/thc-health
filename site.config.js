window.HEALTH_CENTER_SITE_CONFIG = Object.freeze({
  projectName: "thc-health",
  publicApiUrl: "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/thc-health-api?api=public",
  adminApiUrl: "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/thc-health-api",
  lineHubApiUrl: "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/line-service-hub-web",
  fallback: {
    unitName: "ศูนย์บริการสาธารณสุขบ้านโทกหัวช้าง",
    municipality: "เทศบาลเมืองเขลางค์นคร",
    tagline: "บริการสุขภาพใกล้บ้าน เข้าถึงง่ายในหน้าเดียว",
    oneStopUrl: "https://line-service-hub.pages.dev/",
    lineContactUrl: "https://line.me/R/ti/p/@610ndlrx",
    officeHours: {
      timezone: "Asia/Bangkok",
      weekdays: [1,2,3,4,5],
      start: "08:30",
      end: "16:30",
      holidays: ["2026-01-01","2026-01-02","2026-03-03","2026-04-06","2026-04-13","2026-04-14","2026-04-15","2026-05-04","2026-05-13","2026-06-01","2026-06-03","2026-07-28","2026-07-29","2026-07-30","2026-08-12","2026-10-13","2026-10-23","2026-12-07","2026-12-10","2026-12-31"],
      closures: [],
      confirmed: true
    }
  }
});
