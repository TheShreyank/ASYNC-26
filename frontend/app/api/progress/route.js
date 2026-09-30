import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || "demo_user_123";

    // Fetch the daily overviews which store the completed_habits JSON arrays
    const { data: overviews, error } = await supabase
      .from('daily_overviews')
      .select('date, completed_habits')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(30);

    if (error) {
      throw error;
    }

    let chartData = [];
    
    // For the hackathon demo: If they haven't generated any daily reviews yet, 
    // inject some fake historical data so the chart looks cool on stage!
    if (!overviews || overviews.length === 0) {
      for(let i=6; i>=0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        chartData.push({
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          completed: Math.floor(Math.random() * 4) + 1, // Random 1-4 habits
        });
      }
    } else {
      // Map the real data
      chartData = overviews.map(row => {
        // Append time to prevent UTC offset shifting the day backwards
        let d = new Date(row.date + 'T12:00:00');
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          completed: Array.isArray(row.completed_habits) ? row.completed_habits.length : 0,
          rawDate: d // keep raw date for padding calculation
        };
      });
      
      // If we only have 1 day of real data (today), let's pad the past 6 days with fake data 
      // so the bar chart isn't just a single lonely bar for the demo!
      if (chartData.length === 1) {
          const firstDay = chartData[0];
          chartData = [];
          
          // Count backwards strictly from the day recorded in the DB
          for(let i=6; i>=1; i--) {
            let d = new Date(firstDay.rawDate);
            d.setDate(d.getDate() - i);
            chartData.push({
              date: d.toLocaleDateString('en-US', { weekday: 'short' }),
              completed: Math.floor(Math.random() * 3) + 1,
            });
          }
          
          // Remove rawDate before sending to client
          delete firstDay.rawDate;
          chartData.push(firstDay); // Add the real today data at the end
      }
    }

    return Response.json({ chartData });

  } catch (error) {
    console.error('[Progress Sync Error]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
