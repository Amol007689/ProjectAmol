import { createClient } from 'npm:@supabase/supabase-js@2';
import { MongoClient } from 'npm:mongodb';

// Define the structure for the data we'll save in MongoDB
interface ClassAverage {
  classroomId: number;
  classroomName: string;
  schoolId: number;
  averageScore: number;
  recordCount: number;
  updatedAt: string;
}

// Deno's serve function is used to handle HTTP requests
Deno.serve(async (req) => {
  // 1. SET UP CORS HEADERS (BEST PRACTICE FOR WEB-ACCESSIBLE FUNCTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }});
  }

  try {
    // 2. INITIALIZE CLIENTS
    // Supabase Admin Client: Use the service_role key for bypassing RLS.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // MongoDB Client
    const mongoClient = new MongoClient(Deno.env.get('MONGO_DB_URI') ?? '');
    await mongoClient.connect();
    const db = mongoClient.db('school_analytics'); // Or your preferred DB name
    const averagesCollection = db.collection<ClassAverage>('class_averages');

    // 3. FETCH DATA FROM SUPABASE
    // Get all classrooms along with their school ID.
    const { data: classrooms, error: classroomError } = await supabaseAdmin
      .from('classrooms')
      .select('id, name, school_id');
    
    if (classroomError) throw classroomError;

    // 4. PROCESS DATA AND SAVE TO MONGODB
    const processingResults = [];

    for (const classroom of classrooms) {
      // For each classroom, get all its progress records.
      const { data: progressData, error: progressError } = await supabaseAdmin
        .from('progress')
        .select('score')
        .eq('classroom_id', classroom.id);

      if (progressError) {
        console.error(`Failed to fetch progress for classroom ${classroom.id}:`, progressError);
        continue; // Skip this classroom and proceed with others
      }

      if (progressData.length === 0) {
        processingResults.push(`Classroom '${classroom.name}' has no records to average.`);
        continue;
      }
      
      // Calculate the average score
      const totalScore = progressData.reduce((sum, record) => sum + record.score, 0);
      const averageScore = totalScore / progressData.length;

      // Prepare the document for MongoDB
      const classAverageDoc: Omit<ClassAverage, '_id'> = {
        classroomId: classroom.id,
        classroomName: classroom.name,
        schoolId: classroom.school_id,
        averageScore: parseFloat(averageScore.toFixed(2)), // Round to 2 decimal places
        recordCount: progressData.length,
        updatedAt: new Date().toISOString(),
      };

      // Use updateOne with upsert:true to either update an existing document
      // for this classroom or insert a new one if it doesn't exist.
      await averagesCollection.updateOne(
        { classroomId: classroom.id }, // The filter to find the document
        { $set: classAverageDoc },      // The data to set/update
        { upsert: true }               // The option to create if not found
      );
      
      processingResults.push(`Processed classroom '${classroom.name}' with an average of ${averageScore.toFixed(2)}.`);
    }

    // 5. CLOSE CONNECTION AND RETURN RESPONSE
    await mongoClient.close();

    return new Response(JSON.stringify({
      message: 'Classroom averages calculated and saved successfully.',
      details: processingResults,
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      status: 200,
    });

  } catch (err) {
    // 6. ERROR HANDLING
    console.error("Error in Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      status: 500,
    });
  }
});
