import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';

function LifecycleMessage({ status, message }) {
  if (status == 'deprecated')
    return <Alert severity="warning">{message}</Alert>
  return <Alert severity="info">{message}</Alert>
}

function ChipFromStatus({ status }) {
  let chipStyle = {
                    backgroundColor: '#76d2ff',
                    color: 'black'
                  };
  switch (status) {
    case 'in_development':
      chipStyle.backgroundColor = '#76d2ff';
      break;
    case 'in_review':
      chipStyle.backgroundColor = '#fdd58c';
      break;
    case 'reviewed':
      chipStyle.backgroundColor = '#60dfc0';
      break;
    case 'deprecated':
      chipStyle.backgroundColor = 'black';
      chipStyle.color = 'white';
      break;
    default:
      console.warn(`Unknown lifecycle status: ${status}`);
  }
  return <Chip label={status} size="small" style={chipStyle} color='primary'/>

}

export function LifecycleDescription({ lifecycle }) {

  return <>
          <ChipFromStatus status={(lifecycle && lifecycle.status) || "in_development"} />
          {lifecycle && lifecycle.message && <LifecycleMessage status={lifecycle.status} message={lifecycle.message} />}
         </>
}
