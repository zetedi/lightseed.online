import {useEffect,useState} from 'react';
import {seedPublicRead} from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';
type Person={uid:string;displayName:string|null};
export function PersonPicker({disabled,onSelect}:{disabled:boolean;onSelect:(uid:string)=>void}) {
  const [query,setQuery]=useState(''),[people,setPeople]=useState<Person[]>([]),[selected,setSelected]=useState<Person|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;
    if(!query.trim() || selected)return ()=>{active=false;};
    void seedPublicRead('/v1/people?q='+encodeURIComponent(query.trim())+'&limit=20').then(body=>{if(active)setPeople((body as {people:Person[]}).people);}).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[query,selected]);
  return <div><label>{en.name}<input maxLength={60} value={query} disabled={disabled} onChange={e=>{setQuery(e.target.value);setSelected(null);setPeople([]);setError(false);onSelect('');}}/></label>
    {error && <p role="alert">{en.err_save_retry}</p>}
    {selected ? <p>{selected.displayName}</p> : <ul>{people.map(person=><li key={person.uid}><button type="button" disabled={disabled} onClick={()=>{setSelected(person);setQuery(person.displayName??'');setPeople([]);onSelect(person.uid);}}>{person.displayName || en.unnamed_keeper}</button></li>)}</ul>}
  </div>;
}
