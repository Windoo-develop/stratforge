export async function exportNodeAsPng(node: HTMLElement, fileName: string) {
  const { toPng } = await import('html-to-image')

  const dataUrl = await toPng(node, {
    cacheBust: true,
    backgroundColor: '#08111d',
    pixelRatio: 2,
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}
