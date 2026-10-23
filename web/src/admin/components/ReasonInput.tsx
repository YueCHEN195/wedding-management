import { Input, Tag } from 'antd';
import type { TextAreaProps } from 'antd/es/input';
import './reason-input.css';

type Props = Omit<TextAreaProps, 'onChange'> & {
  reasons: readonly string[];
  onChange?: (value: string) => void;
};
/** Form-controlled text with optional, keyboard-accessible reason suggestions. */
export function ReasonInput({ reasons, value, onChange, disabled, id, ...props }: Props) {
  const text = String(value ?? '');
  const parts = text.split('；');
  const selected = (reason: string) => parts.some((part) => part.trim() === reason);
  const nextText = (reason: string) =>
    selected(reason)
      ? parts.filter((part) => part.trim() !== reason).join('；')
      : `${text}${text.trim() ? '；' : ''}${reason}`;
  return (
    <div className="reason-input">
      <div className="reason-input-options" role="group" aria-label="快捷填写原因">
        {reasons.map((reason) => (
          <Tag.CheckableTag
            key={reason}
            checked={selected(reason)}
            disabled={
              disabled || (props.maxLength != null && nextText(reason).length > props.maxLength)
            }
            onChange={() => onChange?.(nextText(reason))}
          >
            {reason}
          </Tag.CheckableTag>
        ))}
      </div>
      <Input.TextArea
        {...props}
        id={id}
        value={text}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}
