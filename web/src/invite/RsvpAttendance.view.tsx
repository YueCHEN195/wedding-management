import { MAX_HEADCOUNT } from '@shared/constraints';
import type { Attending } from '@shared/types';
import type { InvitationModel } from './useInvitation';
import { rsvpCopy } from './rsvpPresentation';

export function RsvpAttendance({
  model,
}: {
  model: Pick<
    InvitationModel,
    | 'attending'
    | 'setAttending'
    | 'headcount'
    | 'setHeadcount'
    | 'children'
    | 'setChildren'
    | 'saving'
  >;
}) {
  const { attending, setAttending, headcount, setHeadcount, children, setChildren, saving } = model;
  return (
    <>
      <fieldset className="rsvp-attendance" disabled={saving} aria-describedby="rsvp-choice-helper">
        <legend>是否出席</legend>
        <div className="rsvp-choices">
          {(['yes', 'maybe', 'no'] as Attending[]).map((value) => (
            <label className="rsvp-choice" key={value}>
              <input
                type="radio"
                name="attending"
                value={value}
                checked={attending === value}
                onChange={() => setAttending(value)}
              />
              <span>{rsvpCopy[value].label}</span>
            </label>
          ))}
        </div>
        <p className="rsvp-helper" id="rsvp-choice-helper">
          {rsvpCopy[attending].helper}
        </p>
      </fieldset>
      {attending === 'yes' && (
        <div className="rsvp-party">
          <div className="rsvp-count-row">
            <span>
              出席人数<small>含本人及儿童</small>
            </span>
            <div className="rsvp-stepper">
              <button
                type="button"
                aria-label="减少出席人数"
                disabled={saving || headcount <= 1}
                onClick={() => {
                  setHeadcount((n) => Math.max(1, n - 1));
                  setChildren((n) => Math.min(n, Math.max(1, headcount - 1)));
                }}
              >
                −
              </button>
              <output aria-label="出席人数" aria-live="polite">
                {headcount}
              </output>
              <button
                type="button"
                aria-label="增加出席人数"
                disabled={saving || headcount >= MAX_HEADCOUNT}
                onClick={() => setHeadcount((n) => Math.min(MAX_HEADCOUNT, n + 1))}
              >
                ＋
              </button>
            </div>
          </div>
          <div className="rsvp-count-row">
            <span>其中儿童</span>
            <div className="rsvp-stepper">
              <button
                type="button"
                aria-label="减少儿童人数"
                disabled={saving || children <= 0}
                onClick={() => setChildren((n) => Math.max(0, n - 1))}
              >
                −
              </button>
              <output aria-label="其中儿童人数" aria-live="polite">
                {children}
              </output>
              <button
                type="button"
                aria-label="增加儿童人数"
                disabled={saving || children >= headcount}
                onClick={() => setChildren((n) => Math.min(headcount, n + 1))}
              >
                ＋
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
