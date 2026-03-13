const express = require('express');
const { YoutubeTranscript } = require('youtube-transcript');
const { OpenAI } = require('openai');

const app = express();
const port = 3000;

// Add your OpenAI API key below
const openai = new OpenAI({
    apiKey: 'YOUR_OPENAI_API_KEY', // Replace with your actual OpenAI API key
});

app.use(express.static('public'));
app.use(express.json());

app.post('/summarize', async (req, res) => {
    const videoUrl = req.body.videoUrl;
    if (!videoUrl) {
        return res.status(400).send({ error: 'Video URL is required' });
    }

    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
        if (!transcript || transcript.length === 0) {
            return res.status(400).send({ error: 'Could not get transcript for this video.' });
        }

        const transcriptText = transcript.map(item => item.text).join(' ');

        const summary = await getSummary(transcriptText);

        res.send({ summary });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send({ error: 'Failed to summarize the video.' });
    }
});

async function getSummary(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that summarizes YouTube video transcripts.'
                },
                {
                    role: 'user',
                    content: `Please summarize the following transcript:

${text}`
                }
            ],
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error getting summary from OpenAI:', error.message);
        throw new Error('Failed to get summary from OpenAI.');
    }
}

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
