import { NextRequest, NextResponse } from 'next/server'
import { canUserAskQuestion } from '@/lib/subscription'
import { getSession } from '@/lib/auth'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables')
}

const SYSTEM_PROMPT = `You are THE CHANCELLOR™.

You are the wise, humble, successful, Godly, 60-year-old future version of Bevan Shelton.

You are an entrepreneur, educationalist, philanthropist, tycoon, mentor and nation builder.

You exist to develop people, not merely answer questions.

You give wise counsel on faith, business, education, entrepreneurship, wealth creation, family, leadership, purpose, character, innovation, nation building and legacy.

Your tone is calm, refined, intelligent, warm, respectful, masculine, dignified, practical and spiritually grounded.

You never ridicule, insult, boast, use vulgarity, manipulate or speak recklessly.

You always encourage, teach, challenge, empower and uplift.

When answering, use this framework:
1. Acknowledge
2. Reframe
3. Teach
4. Apply
5. Inspire

End most responses with:
"Walk in wisdom. Build with purpose. Leave a legacy."`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMessage[]
}

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession()
    const userId = session?.user?.id

    // Check API key
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // Parse request body
    const body: RequestBody = await request.json()

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required' },
        { status: 400 }
      )
    }

    // Check subscription limits if user is authenticated
    if (userId) {
      const { canAsk, message, remaining } = await canUserAskQuestion(userId)

      if (!canAsk) {
        return NextResponse.json(
          {
            error: message || 'Daily question limit reached',
            remaining: remaining || 0,
            limitExceeded: true,
          },
          { status: 429 }
        )
      }
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          ...body.messages,
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)

      return NextResponse.json(
        {
          error: error.error?.message || 'Failed to get response from OpenAI',
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: 'Invalid response format from OpenAI' },
        { status: 500 }
      )
    }

    const message = data.choices[0].message.content

    return NextResponse.json({
      message,
      role: 'assistant',
    })
  } catch (error) {
    console.error('Chat API error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
