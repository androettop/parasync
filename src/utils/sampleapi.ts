export const getRepoConfigFromSampleAPI = (name: string, domain: string) => {
  return `display_name: ${name}
name: ${domain}
search_url: |
  ~'https://${domain}/api/maps?' ||
  'query=' || encodeURIComponent(query) ||
  '&limit=' || pageSize ||
  '&offset=' || ((page - 1) * pageSize) ||
  '&sort=' || 
  case(
    sortBy,
    ['uploadedAt', 'title', 'artist', 'uploadedBy', 'downloads'],
    ['submissionDate', 'title', 'artist', 'author', 'downloadCount']
  ) ||
  '&sortDirection=' || sortDirection
response:
  songs_array: ~response.maps
  serializer: msgpackr
  fields:
    id: ~song.id
    uploadedAt: ~song.submissionDate
    uploadedBy: ~song.author
    title: ~song.title
    artist: ~song.artist
    downloads: ~song.downloadCount
    coverUrl: ~'https://${domain}/covers/' || song.id || '/' || song.albumArt
    downloadUrl: ~'https://maps.${domain}/maps/' || song.id || '.zip'
    difficulties: |
      ~
      map(
        getFn('difficultyName'),
        song.difficulties
      )
`.trim();
};
