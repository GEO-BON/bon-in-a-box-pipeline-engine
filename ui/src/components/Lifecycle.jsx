import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';

export function LifecycleMessage({ status, message, style }) {
  return <Alert style={style} severity={status == 'deprecated' ? "warning" : "info"}>
    {message}
  </Alert>
}

export function LifecycleChip({ lifecycle }) {

  let status = lifecycle?.status || "in_development";

  let displayText = "Unknown";
  let title = ""
  let chipStyle = {
                    marginBottom: '8px',
                    backgroundColor: '#76d2ff',
                    color: 'black',
                    marginRight: '6px'
                  };
  switch (status) {
    case 'in_development':
      chipStyle.backgroundColor = '#76d2ff';
      displayText = "In Development";
      title = "Should be used with caution."
      break;
    case 'in_review':
      chipStyle.backgroundColor = '#fdd58c';
      displayText = "In Review";
      title = "Finalised by their authors and currently going through a formal peer-review process."
      break;
    case 'reviewed':
      chipStyle.backgroundColor = '#60dfc0';
      displayText = "Reviewed";
      title = "Approved by an independent peer-review process. Use according to documented guidelines."
      break;
    case 'deprecated':
      chipStyle.backgroundColor = 'black';
      chipStyle.color = 'white';
      displayText = "Deprecated";
      title = "For backwards compatibility only."
      break;
    case 'example':
      chipStyle.backgroundColor = '#c7a9ff';
      displayText = "Example";
      title = "For testing and training purpose only. Does not perform any real analysis."
      break;
    case 'none': // used when script not found on server
      return null;
    default:
      console.warn(`Unknown lifecycle status: ${status}`);
  }
  return <Chip label={displayText} size="small" title={title} style={chipStyle} color='primary'/>

}
