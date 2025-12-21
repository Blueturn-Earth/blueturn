self.addEventListener('fetch', event => {
  if (event.request.method === 'POST' &&
      new URL(event.request.url).pathname === '/share') {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  const formData = await request.formData();
  const file = formData.get('photo');

  // Store file temporarily (IndexedDB / cache / memory)
  self.sharedPhoto = file;

  return Response.redirect('/process', 303);
}
