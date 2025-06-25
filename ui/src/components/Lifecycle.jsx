import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';

export function LifecycleMessage({ status, message, style }) {
  return <Alert style={style} severity={status == 'deprecated' ? "warning" : "info"}>
    {message}
  </Alert>
}

function ChipFromStatus({ status }) {
  let displayText = "Unknown";
  let chipStyle = {
                    marginBottom: '8px',
                    backgroundColor: '#76d2ff',
                    color: 'black'
                  };
  switch (status) {
    case 'in_development':
      chipStyle.backgroundColor = '#76d2ff';
      displayText = "In Development";
      break;
    case 'in_review':
      chipStyle.backgroundColor = '#fdd58c';
      displayText = "In Review";
      break;
    case 'reviewed':
      chipStyle.backgroundColor = '#60dfc0';
      displayText = "Reviewed";
      break;
    case 'deprecated':
      chipStyle.backgroundColor = 'black';
      chipStyle.color = 'white';
      displayText = "Deprecated";
      break;
    case 'example':
      chipStyle.backgroundColor = '#c7a9ff';
      displayText = "Example";
      break;
    default:
      console.warn(`Unknown lifecycle status: ${status}`);
  }
  return <Chip label={displayText} size="small" style={chipStyle} color='primary'/>

}

export function LifecycleDescription({ lifecycle }) {
  return <div style={{marginBottom: "20px"}}>
          <ChipFromStatus status={(lifecycle && lifecycle.status) || "in_development"} />
          {lifecycle?.message && <LifecycleMessage status={lifecycle.status} message={lifecycle.message} />}
         </div>
}
