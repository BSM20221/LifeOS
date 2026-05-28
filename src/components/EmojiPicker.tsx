import { emojiPresets } from "../emojiPresets";

export function EmojiPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <fieldset className="emoji-picker">
      <legend>{label}</legend>
      <div className="emoji-picker-grid">
        <button className={!value ? "selected" : ""} type="button" onClick={() => onChange("")}>
          None
        </button>
        {emojiPresets.map((preset) => (
          <button
            className={value === preset.emoji ? "selected" : ""}
            type="button"
            key={`${preset.emoji}-${preset.label}`}
            title={preset.label}
            aria-label={`${preset.label} ${preset.emoji}`}
            onClick={() => onChange(preset.emoji)}
          >
            <span>{preset.emoji}</span>
            <small>{preset.label}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
