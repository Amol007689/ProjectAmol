import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Create a .env.local file in your Next.js root
// and add these variables.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Components ---

// Simple Modal for editing a record
function EditProgressModal({ record, onClose, onSave }) {
    const [score, setScore] = useState(record.score);
    const [notes, setNotes] = useState(record.notes || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const newScore = parseInt(score, 10);
        if (isNaN(newScore) || newScore < 0 || newScore > 100) {
            setError('Score must be a number between 0 and 100.');
            return;
        }

        setIsSaving(true);
        setError('');
        await onSave(record.id, { score: newScore, notes });
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 md:p-8 w-11/12 max-w-md shadow-2xl border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">Edit Progress</h2>
                <p className="text-gray-400 mb-2">Student: <span className="font-semibold text-gray-200">{record.profiles.full_name}</span></p>
                <p className="text-gray-400 mb-6">Subject: <span className="font-semibold text-gray-200">{record.subject}</span></p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="score" className="block text-sm font-medium text-gray-300 mb-1">Score (0-100)</label>
                        <input
                            type="number"
                            id="score"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                        <textarea
                            id="notes"
                            rows="3"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Main Page Component
export default function TeacherDashboardPage() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [progressRecords, setProgressRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingRecord, setEditingRecord] = useState(null);

    // --- Auth & Profile ---
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // For a real app, you'd redirect to a login page
                // router.push('/login');
                console.log("No session found. Please log in.");
                setError("You must be logged in to view this page.");
                setLoading(false);
                return;
            }
            setUser(session.user);

            // Fetch user profile to check role
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profileData) {
                setError("Could not fetch user profile. Ensure you have a profile record linked to your auth user.");
                setLoading(false);
                return;
            }

            if (profileData.role !== 'teacher' && profileData.role !== 'head_teacher') {
                 setError("Access Denied. This page is for teachers only.");
                 setLoading(false);
                 return;
            }
            
            setProfile(profileData);
        };
        checkUser();
    }, []);

    // --- Data Fetching ---
    useEffect(() => {
        if (!profile) return; // Don't fetch until profile is loaded

        const fetchClassrooms = async () => {
            // RLS ensures only classrooms in the teacher's school are returned.
            // For a 'teacher', you might want to only fetch classes they are assigned to.
            // This example fetches all classrooms in the school for simplicity.
            const { data, error } = await supabase
                .from('classrooms')
                .select('id, name');

            if (error) {
                console.error("Error fetching classrooms:", error);
                setError("Failed to load classrooms. Your RLS policies might be blocking access.");
            } else {
                setClassrooms(data);
                if (data.length > 0) {
                    setSelectedClassroomId(data[0].id);
                }
            }
            setLoading(false);
        };

        fetchClassrooms();
    }, [profile]);

    useEffect(() => {
        if (!selectedClassroomId) {
            setProgressRecords([]);
            return;
        };

        const fetchProgressRecords = async () => {
            setLoading(true);
            // RLS ensures the teacher can only fetch records from their assigned classes.
            const { data, error } = await supabase
                .from('progress')
                .select('*, profiles (full_name)') // Join to get student's name
                .eq('classroom_id', selectedClassroomId)
                .order('recorded_at', { ascending: false });

            if (error) {
                console.error("Error fetching progress:", error);
                setError(`Failed to load progress records. RLS policy might be blocking access to classroom ${selectedClassroomId}.`);
                setProgressRecords([]);
            } else {
                setProgressRecords(data);
                setError('');
            }
            setLoading(false);
        };

        fetchProgressRecords();
    }, [selectedClassroomId]);
    
    // --- Data Mutation ---
    const handleUpdateProgress = async (recordId, updates) => {
        const { error } = await supabase
            .from('progress')
            .update(updates)
            .eq('id', recordId);

        if (error) {
            console.error("Error updating progress:", error);
            setError("Failed to update record. Check RLS UPDATE policy and permissions.");
        } else {
            // Refresh data
            setProgressRecords(records =>
                records.map(r => (r.id === recordId ? { ...r, ...updates } : r))
            );
        }
    };


    if (loading && !profile) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
    }
    
    if (error) {
       return <div className="min-h-screen bg-gray-900 text-red-400 flex items-center justify-center p-8 text-center">{error}</div>;
    }

    return (
        <>
            {editingRecord && (
                <EditProgressModal
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSave={handleUpdateProgress}
                />
            )}

            <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-4xl font-bold text-white">Teacher Dashboard</h1>
                        <p className="text-gray-400 mt-1">Welcome, {profile?.full_name || user?.email}</p>
                    </header>

                    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                        <div className="mb-6">
                            <label htmlFor="classroom-select" className="block text-lg font-medium text-gray-300 mb-2">
                                Select a Classroom
                            </label>
                            <select
                                id="classroom-select"
                                value={selectedClassroomId}
                                onChange={(e) => setSelectedClassroomId(e.target.value)}
                                className="w-full md:w-1/2 bg-gray-700 border border-gray-600 text-white rounded-md p-3 focus:ring-2 focus:ring-indigo-500"
                            >
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Progress Records</h2>
                            {loading ? (
                                <p>Loading records...</p>
                            ) : progressRecords.length === 0 ? (
                                <p className="text-gray-400">No progress records found for this classroom.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-700">
                                        <thead className="bg-gray-700/50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Student</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Subject</th>
                                                <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-white">Score</th>
                                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {progressRecords.map((record) => (
                                                <tr key={record.id}>
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{record.profiles.full_name}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{record.subject}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300 text-center">{record.score}</td>
                                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <button onClick={() => setEditingRecord(record)} className="text-indigo-400 hover:text-indigo-300">
                                                            Edit<span className="sr-only">, {record.profiles.full_name}</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
