import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get tokens from Supabase
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('google_access_token, google_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (dbError || !dbUser) {
      return Response.json({ error: 'User not found in database' }, { status: 404 });
    }

    // 2. Setup Google OAuth Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    oauth2Client.setCredentials({
      access_token: dbUser.google_access_token,
      refresh_token: dbUser.google_refresh_token
    });

    // 3. Fetch today's events from Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get start and end of today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items.map(item => ({
      id: item.id,
      summary: item.summary || "Busy",
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      htmlLink: item.htmlLink
    }));

    return Response.json({ events });

  } catch (error) {
    console.error('[Calendar Sync Error]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
