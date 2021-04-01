import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import Router from 'next/router';
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';
import { ALL_PRODUCTS_QUERY } from './Products';

const CREATE_PRODUCT_MUTATION = gql`
  mutation CREATE_PRODUCT_MUTATION(
    $name: String!
    $description: String!
    $price: Int!
    $image: Upload
  ) {
    createProduct(
      data: {
        name: $name
        description: $description
        price: $price
        status: "AVAILABLE"
        photo: { create: { image: $image, altText: $name } }
      }
    ) {
      id
      price
      name
      description
    }
  }
`;

export default function CreateProduct() {
  const { inputs, handleChange, clearForm, resetForm } = useForm({
    name: '',
    image: '',
    price: 0,
    description: '',
  });

  const [createProduct, { data, error, loading }] = useMutation(
    CREATE_PRODUCT_MUTATION,
    {
      variables: inputs,
      refetchQueries: [{ query: ALL_PRODUCTS_QUERY }],
    }
  );

  console.log(createProduct);
  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createProduct();
          clearForm();
          Router.push({
            pathname: `/product/${res.data.createProduct.id}`,
          });
        }}
      >
        <DisplayError error={error} />
        <fieldset disabled={loading} aria-busy={loading}>
          {/* aria-busy> */}
          <label htmlFor="name">
            Name
            <input
              type="text"
              id="name"
              name="name"
              placeholde="Name"
              value={inputs.name}
              onChange={handleChange}
            />
          </label>
          <label htmlFor="image">
            Image
            <input
              required
              type="file"
              id="image"
              name="image"
              onChange={handleChange}
            />
          </label>
          <label htmlFor="price">
            Price
            <input
              type="number"
              id="price"
              name="price"
              placeholde="price"
              value={inputs.price}
              onChange={handleChange}
            />
          </label>
          <label htmlFor="description">
            Description
            <textarea
              id="description"
              name="description"
              placeholde="Description"
              value={inputs.description}
              onChange={handleChange}
            />
          </label>
          <button type="submit">+ Add product</button>
        </fieldset>
      </form>
    </div>
  );
}
