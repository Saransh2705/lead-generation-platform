'use client';

import { useState } from 'react';
import Combobox, { Opt } from './Combobox';

// Themed dropdown usable inside a server-action <form> (mirrors its value into a hidden input).
export default function FormCombobox({ name, options, defaultValue = '', placeholder }: {
  name: string; options: Opt[]; defaultValue?: string; placeholder?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <>
      <Combobox value={v} options={options} onChange={setV} placeholder={placeholder} />
      <input type="hidden" name={name} value={v} />
    </>
  );
}
