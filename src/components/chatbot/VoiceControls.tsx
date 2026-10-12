import { Mic, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mic state handed to the chat views by ChatbotDrawer. */
export interface VoiceInputControls {
  /** False in browsers without speech recognition (e.g. Firefox): no mic is shown. */
  supported: boolean;
  listening: boolean;
  /** What has been heard so far, shown live in the input. */
  interim: string;
  onToggle: () => void;
}

/** Spoken-reply state handed to the chat views by ChatbotDrawer. */
export interface SpeechOutputControls {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  onToggle: () => void;
}

interface MicButtonProps {
  voice: VoiceInputControls;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
}

/** Tap to talk; tap again to finish and send. */
export const MicButton = ({ voice, disabled, className, iconClassName = "h-4 w-4" }: MicButtonProps) => {
  if (!voice.supported) return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={voice.onToggle}
        disabled={disabled && !voice.listening}
        aria-pressed={voice.listening}
        aria-label={voice.listening ? "Stop listening and send" : "Speak your message"}
        title={voice.listening ? "Stop and send" : "Speak your message"}
        className={cn(
          "rounded-lg hover:bg-white/10",
          // The hover variants matter: the pointer is still over the button right after a tap.
          voice.listening &&
            "text-red-400 bg-red-500/15 hover:text-red-400 hover:bg-red-500/25 motion-safe:animate-pulse",
          className
        )}
      >
        <Mic className={iconClassName} />
      </Button>
      {/* Screen readers: the pulse is visual only. */}
      <span role="status" aria-live="polite" className="sr-only">
        {voice.listening ? "Listening" : ""}
      </span>
    </>
  );
};

interface SpeakToggleProps {
  speech: SpeechOutputControls;
  className?: string;
}

/** Header toggle: read the assistant's replies aloud. */
export const SpeakToggle = ({ speech, className }: SpeakToggleProps) => {
  if (!speech.supported) return null;
  const label = speech.enabled ? "Turn off spoken replies" : "Read replies aloud";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={speech.onToggle}
      aria-pressed={speech.enabled}
      aria-label={label}
      title={label}
      className={cn(
        "hover:bg-white/10 rounded-full",
        speech.enabled && speech.speaking && "text-primary hover:text-primary motion-safe:animate-pulse",
        className
      )}
    >
      {speech.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
  );
};
