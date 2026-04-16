import './style.css';

export function Text(props: any): any {
  const { id, text, variant = 'body' } = props;

  return (
    <text key={id} className={`text-${variant}`}>
      {text as string}
    </text>
  );
}
