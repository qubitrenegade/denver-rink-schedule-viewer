#!/usr/bin/env bun

import { readFile } from 'fs/promises';
import { join } from 'path';

async function debugDUEvents() {
  try {
    // Read the DU events file
    const duFilePath = join(process.cwd(), 'data', 'du-ritchie.json');
    const duContent = await readFile(duFilePath, 'utf-8');
    const duEvents = JSON.parse(duContent);
    
    console.log('🔍 DU Ritchie Events Debug Report');
    console.log('================================');
    console.log(`Total events in file: ${duEvents.length}`);
    
    // Check date ranges
    const now = new Date();
    const fourDaysFromNow = new Date(now.getTime() + (4 * 24 * 60 * 60 * 1000));
    
    console.log(`\n📅 Date Analysis:`);
    console.log(`Current time: ${now.toLocaleString()}`);
    console.log(`4 days from now: ${fourDaysFromNow.toLocaleString()}`);
    
    // Analyze dates
    let upcomingEvents = 0;
    let pastEvents = 0;
    let futureEvents = 0;
    
    const categoryCount: Record<string, number> = {};
    
    duEvents.forEach((event: any, index: number) => {
      const startTime = new Date(event.startTime);
      const category = event.category;
      
      // Count categories
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      
      // Check date ranges
      if (startTime < now) {
        pastEvents++;
      } else if (startTime <= fourDaysFromNow) {
        upcomingEvents++;
        
        // Show first few upcoming events
        if (upcomingEvents <= 5) {
          console.log(`\n📋 Upcoming Event ${upcomingEvents}:`);
          console.log(`   Title: ${event.title}`);
          console.log(`   Start: ${startTime.toLocaleString()}`);
          console.log(`   Category: ${event.category}`);
          console.log(`   RinkId: ${event.rinkId}`);
        }
      } else {
        futureEvents++;
      }
    });
    
    console.log(`\n📊 Date Distribution:`);
    console.log(`   Past events: ${pastEvents}`);
    console.log(`   Next 4 days: ${upcomingEvents}`);
    console.log(`   Future events: ${futureEvents}`);
    
    console.log(`\n🏷️ Category Distribution:`);
    Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });
    
    // Check the combined file too
    const combinedFilePath = join(process.cwd(), 'data', 'combined.json');
    const combinedContent = await readFile(combinedFilePath, 'utf-8');
    const combinedEvents = JSON.parse(combinedContent);
    
    const duEventsInCombined = combinedEvents.filter((event: any) => event.rinkId === 'du-ritchie');
    console.log(`\n🔗 Combined File Analysis:`);
    console.log(`   Total events in combined: ${combinedEvents.length}`);
    console.log(`   DU events in combined: ${duEventsInCombined.length}`);
    
    // Check if there are any DU events in the upcoming range in combined file
    const duUpcomingInCombined = duEventsInCombined.filter((event: any) => {
      const startTime = new Date(event.startTime);
      return startTime >= now && startTime <= fourDaysFromNow;
    });
    
    console.log(`   DU events in next 4 days (combined): ${duUpcomingInCombined.length}`);
    
    if (duUpcomingInCombined.length > 0) {
      console.log(`\n✅ Sample upcoming DU event from combined file:`);
      const sample = duUpcomingInCombined[0];
      console.log(`   Title: ${sample.title}`);
      console.log(`   Start: ${new Date(sample.startTime).toLocaleString()}`);
      console.log(`   Category: ${sample.category}`);
      console.log(`   RinkId: ${sample.rinkId}`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

await debugDUEvents();
