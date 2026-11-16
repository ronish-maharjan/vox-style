#!/usr/bin/env python3
"""Whisper (faster-whisper) transcription with word timestamps. Fully offline (local model dir).
Usage: transcribe.py --model-dir models/whisper/small.en --jobs jobs.json --out out.json"""
import argparse, json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model-dir', required=True)
    ap.add_argument('--jobs', required=True)    # [{audio, prompt}]
    ap.add_argument('--out', required=True)
    ap.add_argument('--device', default='cpu')
    ap.add_argument('--compute', default='int8')
    ap.add_argument('--beam', type=int, default=5)
    ap.add_argument('--language', default=None,
                    help='ISO 639-1 code; omit or "auto" to auto-detect. Models named *.en always use en.')
    a = ap.parse_args()

    from faster_whisper import WhisperModel
    model = WhisperModel(a.model_dir, device=a.device, compute_type=a.compute, local_files_only=True)
    out = []
    for job in json.load(open(a.jobs)):
        language = a.language
        if language in (None, '', 'auto'):
            language = 'en' if str(a.model_dir).endswith('.en') else None
        segs, info = model.transcribe(
            job['audio'], language=language, beam_size=a.beam, word_timestamps=True,
            condition_on_previous_text=False, vad_filter=False,
            initial_prompt=job.get('prompt') or None)
        words = []
        for s in segs:
            for w in (s.words or []):
                words.append({'w': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3), 'p': round(w.probability, 3)})
        out.append({'audio': job['audio'], 'duration': info.duration, 'words': words})
        print(f"  transcribed {job['audio']}: {len(words)} words", flush=True)
    json.dump(out, open(a.out, 'w'))


if __name__ == '__main__':
    main()
