export default defineEventHandler(async () => {
  const { effects, formats } = await getEffects()
  return { effects, formats }
})
