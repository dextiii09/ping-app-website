const params = new URLSearchParams(location.search);
history.replaceState(null, '', location.pathname);

let result = 'failed';
try {
  const expectedState = sessionStorage.getItem('ping_instagram_state');
  sessionStorage.removeItem('ping_instagram_state');
  if (expectedState && params.get('state') === expectedState) {
    const code = params.get('code');
    if (code) {
      const { supabase } = await import('./supabaseClient.js');
      const { data, error } = await supabase.functions.invoke('instagram-media-kit', {
        body: { action: 'finish', state: expectedState, code },
      });
      if (!error && data?.connected) result = 'connected';
    } else if (params.get('error') === 'access_denied') {
      result = 'cancelled';
    }
  }
} catch {
  // Return to Ping with a retry message.
}
try {
  sessionStorage.setItem('ping_resume_view', 'mediakit');
  sessionStorage.setItem('ping_instagram_result', result);
} finally {
  location.replace('/');
}
