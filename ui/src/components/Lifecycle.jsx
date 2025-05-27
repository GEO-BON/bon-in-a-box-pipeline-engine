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
  }
  return <Chip label={status} size="small" style={chipStyle} color='primary'/>

}

export function LifecycleDescription({ lifecycle }) {

  return <>
          {lifecycle.status && <ChipFromStatus status={lifecycle.status} /> || <ChipFromStatus status="in_development" />}
          {lifecycle.message && <LifecycleMessage status={lifecycle.status} message={lifecycle.message} />}
         </>
}
