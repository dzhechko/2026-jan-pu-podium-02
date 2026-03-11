# PRD: Sentiment Analysis (US-019, US-020, US-021)

## Overview
LLM-based sentiment analysis using Anthropic Claude API. Analyzes review text, returns sentiment (positive/negative/neutral) with confidence score. Fallback to star rating when LLM unavailable.

## User Stories
- **US-019**: As the system, I analyze review sentiment using LLM
- **US-020**: As the system, I fall back to star rating when LLM is unavailable
- **US-021**: As the system, I route reviews based on sentiment + confidence

## Routing Rules
1. Positive + confidence >= 0.7 → YANDEX_REDIRECT
2. Positive + confidence < 0.7 → use stars as tiebreaker (>=4 → Yandex, else internal)
3. Negative/Neutral → INTERNAL_HIDDEN + promo code

## Fallback
- When LLM API fails: stars >= 4 = positive, else negative, confidence = 0.5

## Integration
- Called after review submission in ReviewService
- Updates Review record with sentiment, confidence, routing decision
