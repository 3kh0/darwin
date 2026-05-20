export default defineEventHandler(async () => {
  let esmbotOk = false
  let runningJobs = 0

  try {
    runningJobs = await getRunningJobCount()
    esmbotOk = true
  } catch {}

  return {
    ok: true,
    esmbot: {
      ok: esmbotOk,
      runningJobs,
    },
  }
})
